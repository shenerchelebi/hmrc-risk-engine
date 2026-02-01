from fastapi import FastAPI, APIRouter, HTTPException, Request, Header, Depends
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import asyncio
import requests
import base64
import boto3
from botocore.exceptions import ClientError
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from io import BytesIO
from jose import JWTError, jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# API Keys and Config
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
BREVO_API_KEY = os.environ.get('BREVO_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@hmrc-detector.com')
SENDER_NAME = os.environ.get('SENDER_NAME', 'HMRC Red-Flag Detector')

# JWT Config
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'default-secret-key')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', 24))

# S3 Config
S3_ENDPOINT_URL = os.environ.get('S3_ENDPOINT_URL')
S3_ACCESS_KEY = os.environ.get('S3_ACCESS_KEY')
S3_SECRET_KEY = os.environ.get('S3_SECRET_KEY')
S3_BUCKET_NAME = os.environ.get('S3_BUCKET_NAME', 'hmrc-reports')
S3_REGION = os.environ.get('S3_REGION', 'eu-west-2')

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# PDF storage directory (fallback for local storage)
PDF_DIR = ROOT_DIR / 'pdfs'
PDF_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Models
class TaxFormInput(BaseModel):
    tax_year: str
    turnover: float
    total_expenses: float
    motor_costs: float
    mileage_claimed: float
    method: str  # "mileage" or "actual"
    home_office_amount: float
    phone_internet: float
    travel_subsistence: float
    marketing: float
    loss_this_year: bool
    loss_last_year: bool
    other_income: bool
    email: EmailStr

class TaxAssessment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    tax_year: str
    turnover: float
    total_expenses: float
    motor_costs: float
    mileage_claimed: float
    method: str
    home_office_amount: float
    phone_internet: float
    travel_subsistence: float
    marketing: float
    loss_this_year: bool = False  # Default to False
    loss_last_year: bool = False  # Default to False
    other_income: bool = False
    profit: float
    expense_ratio: float
    profit_ratio: float
    motor_ratio: float
    home_office_ratio: float
    travel_ratio: float
    mileage_value: float
    mileage_miles: float = 0  # Store actual miles for display
    calculated_loss: bool = False  # True if profit <= 0
    has_data_inconsistency: bool = False  # True if loss_checkbox but profit > 0
    contextual_notes: List[str] = []  # Non-scoring contextual notes
    risk_score: int
    risk_band: str
    triggered_rules: List[str]
    payment_status: str = "pending"
    pdf_path: Optional[str] = None
    pdf_s3_key: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    assessment_id: str
    email: str
    amount: float
    currency: str
    session_id: str
    payment_status: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CheckoutRequest(BaseModel):
    assessment_id: str
    origin_url: str

class AdminUser(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: EmailStr
    password_hash: str
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class AdminRegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    admin_secret: str  # Secret key to allow registration

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

# S3 Client
def get_s3_client():
    """Get S3 client (works with AWS S3 or S3-compatible services)"""
    if not S3_ACCESS_KEY or not S3_SECRET_KEY:
        return None
    
    config = {
        'aws_access_key_id': S3_ACCESS_KEY,
        'aws_secret_access_key': S3_SECRET_KEY,
        'region_name': S3_REGION
    }
    
    if S3_ENDPOINT_URL:
        config['endpoint_url'] = S3_ENDPOINT_URL
    
    return boto3.client('s3', **config)

async def upload_to_s3(file_content: bytes, file_key: str) -> bool:
    """Upload file to S3"""
    try:
        s3_client = get_s3_client()
        if not s3_client:
            logger.warning("S3 not configured, using local storage")
            return False
        
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=file_key,
            Body=file_content,
            ContentType='application/pdf'
        )
        logger.info(f"Uploaded to S3: {file_key}")
        return True
    except ClientError as e:
        logger.error(f"S3 upload error: {str(e)}")
        return False

async def get_from_s3(file_key: str) -> Optional[bytes]:
    """Get file from S3"""
    try:
        s3_client = get_s3_client()
        if not s3_client:
            return None
        
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=file_key)
        return response['Body'].read()
    except ClientError as e:
        logger.error(f"S3 download error: {str(e)}")
        return None

# JWT Functions
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None

async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    admin = await db.admin_users.find_one({"id": payload.get("sub")}, {"_id": 0})
    if not admin or not admin.get("is_active"):
        raise HTTPException(status_code=401, detail="Admin not found or inactive")
    
    return admin

# Risk Calculation Functions
def calculate_risk_score(data: dict) -> tuple:
    """Calculate HMRC risk score based on deterministic rules"""
    score = 0
    triggered_rules = []
    contextual_notes = []  # Non-scoring notes for context
    
    turnover = data['turnover']
    expenses = data['total_expenses']
    motor_costs = data['motor_costs']
    mileage = data['mileage_claimed']
    home_office = data['home_office_amount']
    travel = data['travel_subsistence']
    method = data['method']
    loss_checkbox = data.get('loss_this_year', False)
    loss_last_year = data.get('loss_last_year', False)
    
    # DERIVED PROFIT: Always calculated from turnover - expenses
    profit = turnover - expenses
    calculated_loss = profit <= 0  # True loss based on actual figures
    
    profit_ratio = (profit / turnover * 100) if turnover > 0 else 0
    expense_ratio = (expenses / turnover * 100) if turnover > 0 else 0
    motor_ratio = (motor_costs / turnover * 100) if turnover > 0 else 0
    home_office_ratio = (home_office / turnover * 100) if turnover > 0 else 0
    travel_ratio = (travel / turnover * 100) if turnover > 0 else 0
    mileage_value = mileage * 0.45
    mileage_value_ratio = (mileage_value / turnover * 100) if turnover > 0 else 0
    
    # Track data inconsistency flag
    has_data_inconsistency = False
    
    # Only apply profit margin rules if profit is positive
    if profit > 0:
        if profit_ratio < 5:
            score += 20
            triggered_rules.append("Profit less than 5% of turnover (+20 points)")
        elif profit_ratio < 10:
            score += 10
            triggered_rules.append("Profit between 5-10% of turnover (+10 points)")
        
        # HIGH PROFIT MARGIN CONTEXT (no points added)
        if profit_ratio > 60:
            contextual_notes.append("High profit margin (>{:.0f}%): High profit margins may be normal depending on trade type. HMRC typically considers sector norms rather than margin alone.".format(profit_ratio))
    
    if expense_ratio > 70:
        score += 18
        triggered_rules.append("Expenses exceed 70% of turnover (+18 points)")
    elif expense_ratio > 55:
        score += 10
        triggered_rules.append("Expenses between 55-70% of turnover (+10 points)")
    
    if motor_ratio > 35:
        score += 12
        triggered_rules.append("Motor costs exceed 35% of turnover (+12 points)")
    
    if mileage_value_ratio > 50:
        score += 15
        triggered_rules.append("Mileage claim value exceeds 50% of turnover (+15 points)")
    
    if method.lower() == 'mileage' and motor_ratio > 10:
        score += 10
        triggered_rules.append("Using mileage method with motor costs > 10% of turnover (+10 points)")
    
    if home_office_ratio > 8:
        score += 8
        triggered_rules.append("Home office claims exceed 8% of turnover (+8 points)")
    
    if travel_ratio > 20:
        score += 10
        triggered_rules.append("Travel & subsistence exceeds 20% of turnover (+10 points)")
    
    # LOSS LOGIC FIX: Only trigger loss if calculated_profit <= 0 OR loss_checkbox is true
    # But if loss_checkbox is true AND profit > 0, it's a data inconsistency
    if calculated_loss:
        # Actual loss based on figures
        score += 12
        triggered_rules.append("Loss declared this tax year (+12 points)")
        
        if loss_last_year:
            score += 18
            triggered_rules.append("Consecutive year losses (+18 points)")
    elif loss_checkbox and profit > 0:
        # Data inconsistency: checkbox says loss but figures show profit
        has_data_inconsistency = True
        score += 8
        triggered_rules.append("Data inconsistency: 'Loss' selected but figures show profit (+8 points)")
    
    # Check for rounded numbers
    rounded_count = 0
    values = [turnover, expenses, motor_costs, home_office, travel, data['marketing']]
    for val in values:
        if val > 0 and (val % 1000 == 0 or val % 500 == 0):
            rounded_count += 1
    
    if rounded_count >= 3:
        score += 6
        triggered_rules.append("Multiple rounded figures detected (+6 points)")
    
    # TRANSPARENCY NOTE: Insufficient category breakdown (not a risk trigger)
    total_categorized = motor_costs + home_office + travel + data.get('phone_internet', 0) + data.get('marketing', 0)
    if expenses > 0 and total_categorized < expenses * 0.5:
        contextual_notes.append("Transparency note: Insufficient category breakdown provided. This is not treated as an HMRC risk indicator unless misclassification or inconsistency is detected.")
    
    score = min(score, 100)
    
    if score <= 24:
        risk_band = "LOW"
    elif score <= 49:
        risk_band = "MODERATE"
    else:
        risk_band = "HIGH"
    
    return score, risk_band, triggered_rules, {
        'profit': profit,
        'profit_ratio': round(profit_ratio, 2),
        'expense_ratio': round(expense_ratio, 2),
        'motor_ratio': round(motor_ratio, 2),
        'home_office_ratio': round(home_office_ratio, 2),
        'travel_ratio': round(travel_ratio, 2),
        'mileage_value': round(mileage_value, 2),
        'mileage_miles': mileage,  # Store actual miles
        'calculated_loss': calculated_loss,
        'has_data_inconsistency': has_data_inconsistency,
        'contextual_notes': contextual_notes
    }

async def generate_ai_report(assessment: dict) -> str:
    """Generate AI-powered risk report content"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    # Determine profit/loss status for accurate reporting
    profit = assessment['profit']
    has_data_inconsistency = assessment.get('has_data_inconsistency', False)
    loss_checkbox = assessment.get('loss_this_year', False)
    
    # Build accurate status description
    if profit <= 0:
        profit_status = f"Loss of £{abs(profit):,.2f}"
    else:
        profit_status = f"Profit of £{profit:,.2f}"
    
    # Filter triggered rules for PDF - remove loss rule if profit is positive
    pdf_triggered_rules = []
    for rule in assessment['triggered_rules']:
        # Never include "Loss declared this tax year" if profit >= 0
        if profit >= 0 and "Loss declared this tax year" in rule:
            continue
        pdf_triggered_rules.append(rule)
    
    # Add data inconsistency note if applicable
    inconsistency_note = ""
    if has_data_inconsistency:
        inconsistency_note = """
IMPORTANT NOTE ON DATA INCONSISTENCY:
The 'Loss' checkbox was selected, but the calculated figures show a positive profit. 
This internal inconsistency is flagged as a risk indicator because HMRC may query 
declarations that don't match the underlying figures. Please ensure your self-assessment 
accurately reflects whether you made a profit or loss."""
    
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"report-{assessment['id']}",
        system_message="""You are a UK tax compliance analyst. Generate a professional risk assessment report based on the provided data. 

IMPORTANT: 
- Do NOT provide tax advice
- Only explain risk indicators based on triggered rules
- Be factual and reference HMRC's known audit patterns
- Include a document checklist for the taxpayer
- Keep language professional but accessible
- NEVER mention "loss declared" if the calculated profit is positive
- If there's a data inconsistency flag, explain it clearly"""
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Generate a detailed HMRC Risk Assessment Report for the following taxpayer data:

Tax Year: {assessment['tax_year']}
Turnover: £{assessment['turnover']:,.2f}
Total Expenses: £{assessment['total_expenses']:,.2f}
Financial Result: {profit_status}
Profit Margin: {assessment['profit_ratio']}%

Risk Score: {assessment['risk_score']}/100
Risk Band: {assessment['risk_band']}

Triggered Risk Indicators:
{chr(10).join(['- ' + rule for rule in pdf_triggered_rules])}
{inconsistency_note}

Key Ratios:
- Expense Ratio: {assessment['expense_ratio']}%
- Motor Costs Ratio: {assessment['motor_ratio']}%
- Home Office Ratio: {assessment['home_office_ratio']}%
- Travel Ratio: {assessment['travel_ratio']}%
- Mileage Claim Value: £{assessment['mileage_value']:,.2f}

Please provide:
1. Executive Summary (2-3 sentences summarizing the key findings based ONLY on the triggered indicators listed above)
2. Detailed Analysis of Each Triggered Risk Factor
3. What HMRC Typically Examines in These Cases
4. Document Checklist (specific records the taxpayer should maintain)
5. General Recommendations for Record-Keeping

Remember: This is NOT tax advice - only risk indicator analysis."""

    user_message = UserMessage(text=prompt)
    response = await chat.send_message(user_message)
    return response

def create_pdf_report(assessment: dict, ai_content: str) -> tuple:
    """Create PDF report using ReportLab, returns (filename, content_bytes)"""
    pdf_filename = f"hmrc_risk_report_{assessment['id']}.pdf"
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, 
                           rightMargin=72, leftMargin=72, 
                           topMargin=72, bottomMargin=72)
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        textColor=colors.HexColor('#0f172a')
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors.HexColor('#0f172a')
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=12,
        leading=14
    )
    
    warning_style = ParagraphStyle(
        'Warning',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=12,
        leading=14,
        textColor=colors.HexColor('#b45309'),
        backColor=colors.HexColor('#fef3c7'),
        borderPadding=8
    )
    
    disclaimer_style = ParagraphStyle(
        'Disclaimer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.gray,
        spaceAfter=6
    )
    
    elements = []
    
    elements.append(Paragraph("HMRC Risk Assessment Report", title_style))
    elements.append(Spacer(1, 12))
    
    # Determine profit/loss display
    profit = assessment['profit']
    has_data_inconsistency = assessment.get('has_data_inconsistency', False)
    
    if profit <= 0:
        profit_display = f"Loss: £{abs(profit):,.2f}"
    else:
        profit_display = f"Profit: £{profit:,.2f}"
    
    summary_data = [
        ['Tax Year:', assessment['tax_year'], 'Risk Score:', f"{assessment['risk_score']}/100"],
        ['Turnover:', f"£{assessment['turnover']:,.2f}", 'Risk Band:', assessment['risk_band']],
        ['Total Expenses:', f"£{assessment['total_expenses']:,.2f}", 'Result:', profit_display],
    ]
    
    summary_table = Table(summary_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f5f5f4')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#0f172a')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e7e5e4')),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 20))
    
    # Add data inconsistency warning if applicable
    if has_data_inconsistency:
        elements.append(Paragraph("⚠ Data Inconsistency Detected", heading_style))
        inconsistency_text = """The 'Loss' checkbox was selected in your submission, but the calculated figures show a positive profit. This internal inconsistency has been flagged as a risk indicator because HMRC may query declarations that don't match the underlying figures. Please ensure your self-assessment accurately reflects whether you made a profit or loss."""
        elements.append(Paragraph(inconsistency_text, warning_style))
        elements.append(Spacer(1, 10))
    
    # Filter triggered rules for PDF - NEVER show "Loss declared this tax year" if profit >= 0
    elements.append(Paragraph("Risk Indicators Triggered", heading_style))
    for rule in assessment['triggered_rules']:
        # Skip loss rule if profit is positive (the data inconsistency covers this case)
        if profit >= 0 and "Loss declared this tax year" in rule:
            continue
        # Skip consecutive losses rule if profit is positive
        if profit >= 0 and "Consecutive year losses" in rule:
            continue
        elements.append(Paragraph(f"• {rule}", body_style))
    
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("Detailed Analysis", heading_style))
    
    ai_paragraphs = ai_content.split('\n\n')
    for para in ai_paragraphs:
        if para.strip():
            if para.startswith('# '):
                elements.append(Paragraph(para[2:], heading_style))
            elif para.startswith('## '):
                elements.append(Paragraph(para[3:], heading_style))
            else:
                clean_para = para.replace('**', '').replace('*', '').replace('- ', '• ')
                elements.append(Paragraph(clean_para, body_style))
    
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("Important Legal Notice", heading_style))
    disclaimer_text = """This tool provides an automated risk indicator based on user-entered figures and public statistical patterns. It does not provide tax advice and does not submit or amend tax returns. The analysis is based on publicly available information about HMRC's risk assessment criteria and should not be construed as professional tax advice. Users should consult a qualified tax professional for specific advice regarding their tax affairs."""
    elements.append(Paragraph(disclaimer_text, disclaimer_style))
    
    elements.append(Spacer(1, 20))
    elements.append(Paragraph(f"Report generated: {datetime.now(timezone.utc).strftime('%d %B %Y at %H:%M UTC')}", disclaimer_style))
    elements.append(Paragraph(f"Reference: {assessment['id']}", disclaimer_style))
    
    doc.build(elements)
    
    pdf_content = buffer.getvalue()
    buffer.close()
    
    return pdf_filename, pdf_content

async def send_email_with_brevo(email: str, assessment_id: str, pdf_content: bytes, pdf_filename: str):
    """Send email with PDF attachment using Brevo API"""
    try:
        if not BREVO_API_KEY or BREVO_API_KEY == 'placeholder_brevo_key':
            logger.warning("Brevo API key not configured, skipping email")
            return False
        
        pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
        
        payload = {
            "sender": {
                "name": SENDER_NAME,
                "email": SENDER_EMAIL
            },
            "to": [
                {
                    "email": email,
                    "name": "Customer"
                }
            ],
            "subject": "Your HMRC Risk Assessment Report",
            "htmlContent": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; padding: 40px;">
                <h1 style="color: #4ade80; margin-bottom: 20px;">Your HMRC Risk Assessment Report</h1>
                <p>Thank you for using the HMRC Red-Flag Detector.</p>
                <p>Please find your detailed risk assessment report attached to this email.</p>
                <p><strong>Reference:</strong> {assessment_id}</p>
                <hr style="border: 1px solid #333; margin: 20px 0;">
                <p style="color: #888; font-size: 12px;">
                    This tool provides an automated risk indicator based on user-entered figures 
                    and public statistical patterns. It does not provide tax advice.
                </p>
            </div>
            """,
            "attachment": [
                {
                    "name": pdf_filename,
                    "content": pdf_base64
                }
            ]
        }
        
        headers = {
            "accept": "application/json",
            "api-key": BREVO_API_KEY,
            "content-type": "application/json"
        }
        
        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        if response.status_code in [200, 201]:
            logger.info(f"Email sent successfully to {email}")
            return True
        else:
            logger.error(f"Brevo API error: {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False

# API Routes
@api_router.get("/")
async def root():
    return {"message": "HMRC Red-Flag Detector API", "status": "active"}

@api_router.post("/assessment/submit")
async def submit_assessment(form_data: TaxFormInput):
    """Submit tax data and get risk assessment"""
    try:
        data = form_data.model_dump()
        score, risk_band, triggered_rules, calculations = calculate_risk_score(data)
        
        assessment = TaxAssessment(
            email=form_data.email,
            tax_year=form_data.tax_year,
            turnover=form_data.turnover,
            total_expenses=form_data.total_expenses,
            motor_costs=form_data.motor_costs,
            mileage_claimed=form_data.mileage_claimed,
            method=form_data.method,
            home_office_amount=form_data.home_office_amount,
            phone_internet=form_data.phone_internet,
            travel_subsistence=form_data.travel_subsistence,
            marketing=form_data.marketing,
            loss_this_year=form_data.loss_this_year,
            loss_last_year=form_data.loss_last_year,
            other_income=form_data.other_income,
            profit=calculations['profit'],
            expense_ratio=calculations['expense_ratio'],
            profit_ratio=calculations['profit_ratio'],
            motor_ratio=calculations['motor_ratio'],
            home_office_ratio=calculations['home_office_ratio'],
            travel_ratio=calculations['travel_ratio'],
            mileage_value=calculations['mileage_value'],
            calculated_loss=calculations.get('calculated_loss', False),
            has_data_inconsistency=calculations.get('has_data_inconsistency', False),
            risk_score=score,
            risk_band=risk_band,
            triggered_rules=triggered_rules
        )
        
        doc = assessment.model_dump()
        await db.assessments.insert_one(doc)
        
        return {
            "success": True,
            "assessment_id": assessment.id,
            "risk_score": score,
            "risk_band": risk_band,
            "triggered_rules_count": len(triggered_rules),
            "has_data_inconsistency": calculations.get('has_data_inconsistency', False)
        }
    except Exception as e:
        logger.error(f"Assessment submission error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/assessment/{assessment_id}")
async def get_assessment(assessment_id: str):
    """Get assessment details"""
    assessment = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    return {
        "id": assessment['id'],
        "risk_score": assessment['risk_score'],
        "risk_band": assessment['risk_band'],
        "triggered_rules_count": len(assessment['triggered_rules']),
        "payment_status": assessment['payment_status'],
        "tax_year": assessment['tax_year'],
        "turnover": assessment['turnover'],
        "profit": assessment['profit'],
        "email": assessment['email']
    }

@api_router.post("/checkout/create")
async def create_checkout_session(request: CheckoutRequest, http_request: Request):
    """Create Stripe checkout session for PDF report"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    try:
        assessment = await db.assessments.find_one({"id": request.assessment_id}, {"_id": 0})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        if assessment['payment_status'] == 'paid':
            raise HTTPException(status_code=400, detail="Report already purchased")
        
        host_url = request.origin_url
        webhook_url = f"{str(http_request.base_url)}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        success_url = f"{host_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{host_url}/results/{request.assessment_id}"
        
        checkout_request = CheckoutSessionRequest(
            amount=19.99,
            currency="gbp",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "assessment_id": request.assessment_id,
                "email": assessment['email']
            }
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        transaction = PaymentTransaction(
            assessment_id=request.assessment_id,
            email=assessment['email'],
            amount=19.99,
            currency="gbp",
            session_id=session.session_id,
            payment_status="initiated"
        )
        
        await db.payment_transactions.insert_one(transaction.model_dump())
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Checkout creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/checkout/status/{session_id}")
async def check_payment_status(session_id: str):
    """Check payment status and generate report if paid"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    try:
        transaction = await db.payment_transactions.find_one(
            {"session_id": session_id}, 
            {"_id": 0}
        )
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        webhook_url = "placeholder"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        status = await stripe_checkout.get_checkout_status(session_id)
        
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": status.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if status.payment_status == "paid":
            assessment = await db.assessments.find_one(
                {"id": transaction['assessment_id']}, 
                {"_id": 0}
            )
            
            if assessment and assessment['payment_status'] != 'paid':
                # Generate AI report
                ai_content = await generate_ai_report(assessment)
                
                # Create PDF
                pdf_filename, pdf_content = create_pdf_report(assessment, ai_content)
                
                # Try to upload to S3
                s3_key = f"reports/{assessment['id']}/{pdf_filename}"
                s3_uploaded = await upload_to_s3(pdf_content, s3_key)
                
                # Also save locally as backup
                local_path = PDF_DIR / pdf_filename
                with open(local_path, 'wb') as f:
                    f.write(pdf_content)
                
                # Update assessment
                update_data = {
                    "payment_status": "paid",
                    "pdf_path": pdf_filename
                }
                if s3_uploaded:
                    update_data["pdf_s3_key"] = s3_key
                
                await db.assessments.update_one(
                    {"id": transaction['assessment_id']},
                    {"$set": update_data}
                )
                
                # Send email (async)
                asyncio.create_task(
                    send_email_with_brevo(
                        assessment['email'], 
                        assessment['id'], 
                        pdf_content,
                        pdf_filename
                    )
                )
                
                return {
                    "status": status.status,
                    "payment_status": status.payment_status,
                    "assessment_id": transaction['assessment_id'],
                    "pdf_ready": True,
                    "download_url": f"/api/report/download/{transaction['assessment_id']}"
                }
        
        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "assessment_id": transaction['assessment_id'],
            "pdf_ready": False
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Payment status check error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/report/download/{assessment_id}")
async def download_report(assessment_id: str):
    """Download PDF report"""
    assessment = await db.assessments.find_one(
        {"id": assessment_id}, 
        {"_id": 0}
    )
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    if assessment['payment_status'] != 'paid':
        raise HTTPException(status_code=403, detail="Report not purchased")
    
    # Try S3 first
    if assessment.get('pdf_s3_key'):
        pdf_content = await get_from_s3(assessment['pdf_s3_key'])
        if pdf_content:
            return StreamingResponse(
                BytesIO(pdf_content),
                media_type='application/pdf',
                headers={
                    'Content-Disposition': f'attachment; filename="HMRC_Risk_Report_{assessment["tax_year"]}.pdf"'
                }
            )
    
    # Fallback to local storage
    if not assessment.get('pdf_path'):
        raise HTTPException(status_code=404, detail="Report not generated yet")
    
    pdf_path = PDF_DIR / assessment['pdf_path']
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Report file not found")
    
    return FileResponse(
        path=str(pdf_path),
        media_type='application/pdf',
        filename=f"HMRC_Risk_Report_{assessment['tax_year']}.pdf"
    )

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature", "")
        
        webhook_url = str(request.url)
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {
                    "payment_status": "paid",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        return {"status": "received"}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

# Admin Routes
@api_router.post("/admin/register")
async def admin_register(request: AdminRegisterRequest):
    """Register a new admin user"""
    # Check admin secret (simple protection)
    if request.admin_secret != "hmrc-admin-secret-2024":
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    
    # Check if username exists
    existing = await db.admin_users.find_one({"username": request.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create admin user
    admin = AdminUser(
        username=request.username,
        email=request.email,
        password_hash=pwd_context.hash(request.password)
    )
    
    await db.admin_users.insert_one(admin.model_dump())
    
    return {"success": True, "message": "Admin user created"}

@api_router.post("/admin/login", response_model=TokenResponse)
async def admin_login(request: AdminLoginRequest):
    """Admin login"""
    admin = await db.admin_users.find_one({"username": request.username}, {"_id": 0})
    
    if not admin or not pwd_context.verify(request.password, admin['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not admin.get('is_active'):
        raise HTTPException(status_code=401, detail="Account disabled")
    
    token = create_access_token({"sub": admin['id'], "username": admin['username']})
    
    return TokenResponse(
        access_token=token,
        expires_in=JWT_EXPIRATION_HOURS * 3600
    )

@api_router.get("/admin/me")
async def admin_me(admin: dict = Depends(get_current_admin)):
    """Get current admin info"""
    return {
        "id": admin['id'],
        "username": admin['username'],
        "email": admin['email']
    }

@api_router.get("/admin/assessments")
async def get_all_assessments(admin: dict = Depends(get_current_admin)):
    """Get all assessments (admin only)"""
    assessments = await db.assessments.find({}, {"_id": 0}).to_list(1000)
    return {"assessments": assessments, "total": len(assessments)}

@api_router.get("/admin/transactions")
async def get_all_transactions(admin: dict = Depends(get_current_admin)):
    """Get all payment transactions (admin only)"""
    transactions = await db.payment_transactions.find({}, {"_id": 0}).to_list(1000)
    return {"transactions": transactions, "total": len(transactions)}

@api_router.get("/admin/stats")
async def get_admin_stats(admin: dict = Depends(get_current_admin)):
    """Get admin dashboard stats"""
    total_assessments = await db.assessments.count_documents({})
    paid_assessments = await db.assessments.count_documents({"payment_status": "paid"})
    
    low_risk = await db.assessments.count_documents({"risk_band": "LOW"})
    moderate_risk = await db.assessments.count_documents({"risk_band": "MODERATE"})
    high_risk = await db.assessments.count_documents({"risk_band": "HIGH"})
    
    paid_transactions = await db.payment_transactions.count_documents({"payment_status": "paid"})
    total_revenue = paid_transactions * 19.99
    
    return {
        "total_assessments": total_assessments,
        "paid_assessments": paid_assessments,
        "conversion_rate": round((paid_assessments / total_assessments * 100) if total_assessments > 0 else 0, 2),
        "risk_breakdown": {
            "low": low_risk,
            "moderate": moderate_risk,
            "high": high_risk
        },
        "total_revenue": round(total_revenue, 2)
    }

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
