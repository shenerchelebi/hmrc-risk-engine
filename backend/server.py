from fastapi import FastAPI, APIRouter, HTTPException, Request, Header
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import asyncio
import resend
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from io import BytesIO

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# API Keys
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

# Initialize Resend
resend.api_key = RESEND_API_KEY

# PDF storage directory
PDF_DIR = ROOT_DIR / 'pdfs'
PDF_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

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
    loss_this_year: bool
    loss_last_year: bool
    other_income: bool
    # Calculated fields
    profit: float
    expense_ratio: float
    profit_ratio: float
    motor_ratio: float
    home_office_ratio: float
    travel_ratio: float
    mileage_value: float
    # Risk assessment
    risk_score: int
    risk_band: str
    triggered_rules: List[str]
    # Status
    payment_status: str = "pending"  # pending, paid
    pdf_path: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    assessment_id: str
    email: str
    amount: float
    currency: str
    session_id: str
    payment_status: str  # initiated, pending, paid, failed, expired
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CheckoutRequest(BaseModel):
    assessment_id: str
    origin_url: str

class CheckoutStatusRequest(BaseModel):
    session_id: str

class AdminLoginRequest(BaseModel):
    password: str

# Risk Calculation Functions
def calculate_risk_score(data: dict) -> tuple:
    """Calculate HMRC risk score based on deterministic rules"""
    score = 0
    triggered_rules = []
    
    turnover = data['turnover']
    expenses = data['total_expenses']
    motor_costs = data['motor_costs']
    mileage = data['mileage_claimed']
    home_office = data['home_office_amount']
    travel = data['travel_subsistence']
    method = data['method']
    loss_this_year = data['loss_this_year']
    loss_last_year = data['loss_last_year']
    
    # Calculate ratios
    profit = turnover - expenses
    profit_ratio = (profit / turnover * 100) if turnover > 0 else 0
    expense_ratio = (expenses / turnover * 100) if turnover > 0 else 0
    motor_ratio = (motor_costs / turnover * 100) if turnover > 0 else 0
    home_office_ratio = (home_office / turnover * 100) if turnover > 0 else 0
    travel_ratio = (travel / turnover * 100) if turnover > 0 else 0
    mileage_value = mileage * 0.45
    mileage_value_ratio = (mileage_value / turnover * 100) if turnover > 0 else 0
    
    # Apply scoring rules
    if profit_ratio < 5:
        score += 20
        triggered_rules.append("Profit less than 5% of turnover (+20 points)")
    elif profit_ratio < 10:
        score += 10
        triggered_rules.append("Profit between 5-10% of turnover (+10 points)")
    
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
    
    if loss_this_year:
        score += 12
        triggered_rules.append("Loss declared this tax year (+12 points)")
    
    if loss_this_year and loss_last_year:
        score += 18
        triggered_rules.append("Consecutive year losses (+18 points)")
    
    # Check for rounded numbers
    rounded_count = 0
    values = [turnover, expenses, motor_costs, home_office, travel, data['marketing']]
    for val in values:
        if val > 0 and (val % 1000 == 0 or val % 500 == 0):
            rounded_count += 1
    
    if rounded_count >= 3:
        score += 6
        triggered_rules.append("Multiple rounded figures detected (+6 points)")
    
    # Cap at 100
    score = min(score, 100)
    
    # Determine risk band
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
        'mileage_value': round(mileage_value, 2)
    }

async def generate_ai_report(assessment: dict) -> str:
    """Generate AI-powered risk report content"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"report-{assessment['id']}",
        system_message="""You are a UK tax compliance analyst. Generate a professional risk assessment report based on the provided data. 

IMPORTANT: 
- Do NOT provide tax advice
- Only explain risk indicators based on triggered rules
- Be factual and reference HMRC's known audit patterns
- Include a document checklist for the taxpayer
- Keep language professional but accessible"""
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Generate a detailed HMRC Risk Assessment Report for the following taxpayer data:

Tax Year: {assessment['tax_year']}
Turnover: £{assessment['turnover']:,.2f}
Total Expenses: £{assessment['total_expenses']:,.2f}
Profit: £{assessment['profit']:,.2f}
Profit Margin: {assessment['profit_ratio']}%

Risk Score: {assessment['risk_score']}/100
Risk Band: {assessment['risk_band']}

Triggered Risk Indicators:
{chr(10).join(['- ' + rule for rule in assessment['triggered_rules']])}

Key Ratios:
- Expense Ratio: {assessment['expense_ratio']}%
- Motor Costs Ratio: {assessment['motor_ratio']}%
- Home Office Ratio: {assessment['home_office_ratio']}%
- Travel Ratio: {assessment['travel_ratio']}%
- Mileage Claim Value: £{assessment['mileage_value']:,.2f}

Please provide:
1. Executive Summary (2-3 sentences)
2. Detailed Analysis of Each Triggered Risk Factor
3. What HMRC Typically Examines in These Cases
4. Document Checklist (specific records the taxpayer should maintain)
5. General Recommendations for Record-Keeping

Remember: This is NOT tax advice - only risk indicator analysis."""

    user_message = UserMessage(text=prompt)
    response = await chat.send_message(user_message)
    return response

def create_pdf_report(assessment: dict, ai_content: str) -> str:
    """Create PDF report using ReportLab"""
    pdf_filename = f"hmrc_risk_report_{assessment['id']}.pdf"
    pdf_path = PDF_DIR / pdf_filename
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(str(pdf_path), pagesize=letter, 
                           rightMargin=72, leftMargin=72, 
                           topMargin=72, bottomMargin=72)
    
    styles = getSampleStyleSheet()
    
    # Custom styles
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
    
    disclaimer_style = ParagraphStyle(
        'Disclaimer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.gray,
        spaceAfter=6
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph("HMRC Risk Assessment Report", title_style))
    elements.append(Spacer(1, 12))
    
    # Assessment Summary Table
    risk_color = colors.HexColor('#10b981') if assessment['risk_band'] == 'LOW' else \
                 colors.HexColor('#f59e0b') if assessment['risk_band'] == 'MODERATE' else \
                 colors.HexColor('#ef4444')
    
    summary_data = [
        ['Tax Year:', assessment['tax_year'], 'Risk Score:', f"{assessment['risk_score']}/100"],
        ['Turnover:', f"£{assessment['turnover']:,.2f}", 'Risk Band:', assessment['risk_band']],
        ['Total Expenses:', f"£{assessment['total_expenses']:,.2f}", 'Profit:', f"£{assessment['profit']:,.2f}"],
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
    
    # Triggered Rules
    elements.append(Paragraph("Risk Indicators Triggered", heading_style))
    for rule in assessment['triggered_rules']:
        elements.append(Paragraph(f"• {rule}", body_style))
    
    elements.append(Spacer(1, 20))
    
    # AI Generated Content
    elements.append(Paragraph("Detailed Analysis", heading_style))
    
    # Split AI content into paragraphs and add
    ai_paragraphs = ai_content.split('\n\n')
    for para in ai_paragraphs:
        if para.strip():
            # Handle markdown-style headers
            if para.startswith('# '):
                elements.append(Paragraph(para[2:], heading_style))
            elif para.startswith('## '):
                elements.append(Paragraph(para[3:], heading_style))
            else:
                # Clean up markdown formatting
                clean_para = para.replace('**', '').replace('*', '').replace('- ', '• ')
                elements.append(Paragraph(clean_para, body_style))
    
    elements.append(Spacer(1, 30))
    
    # Legal Disclaimer
    elements.append(Paragraph("Important Legal Notice", heading_style))
    disclaimer_text = """This tool provides an automated risk indicator based on user-entered figures and public statistical patterns. It does not provide tax advice and does not submit or amend tax returns. The analysis is based on publicly available information about HMRC's risk assessment criteria and should not be construed as professional tax advice. Users should consult a qualified tax professional for specific advice regarding their tax affairs."""
    elements.append(Paragraph(disclaimer_text, disclaimer_style))
    
    # Generation info
    elements.append(Spacer(1, 20))
    elements.append(Paragraph(f"Report generated: {datetime.now(timezone.utc).strftime('%d %B %Y at %H:%M UTC')}", disclaimer_style))
    elements.append(Paragraph(f"Reference: {assessment['id']}", disclaimer_style))
    
    doc.build(elements)
    return pdf_filename

async def send_email_with_pdf(email: str, assessment_id: str, pdf_filename: str):
    """Send email with PDF attachment"""
    try:
        pdf_path = PDF_DIR / pdf_filename
        
        with open(pdf_path, 'rb') as f:
            pdf_content = f.read()
        
        import base64
        pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
        
        params = {
            "from": SENDER_EMAIL,
            "to": [email],
            "subject": "Your HMRC Risk Assessment Report",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #0f172a;">Your HMRC Risk Assessment Report</h1>
                <p>Thank you for using the HMRC Red-Flag Detector.</p>
                <p>Please find your detailed risk assessment report attached to this email.</p>
                <p>Reference: {assessment_id}</p>
                <hr style="border: 1px solid #e7e5e4; margin: 20px 0;">
                <p style="color: #6b7280; font-size: 12px;">
                    This tool provides an automated risk indicator based on user-entered figures 
                    and public statistical patterns. It does not provide tax advice.
                </p>
            </div>
            """,
            "attachments": [
                {
                    "filename": pdf_filename,
                    "content": pdf_base64
                }
            ]
        }
        
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent successfully to {email}")
        return True
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
        # Calculate risk score
        data = form_data.model_dump()
        score, risk_band, triggered_rules, calculations = calculate_risk_score(data)
        
        # Create assessment record
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
            risk_score=score,
            risk_band=risk_band,
            triggered_rules=triggered_rules
        )
        
        # Save to database
        doc = assessment.model_dump()
        await db.assessments.insert_one(doc)
        
        return {
            "success": True,
            "assessment_id": assessment.id,
            "risk_score": score,
            "risk_band": risk_band,
            "triggered_rules_count": len(triggered_rules)
        }
    except Exception as e:
        logger.error(f"Assessment submission error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/assessment/{assessment_id}")
async def get_assessment(assessment_id: str):
    """Get assessment details (free tier shows limited info)"""
    assessment = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Return limited info for free tier
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
        # Verify assessment exists
        assessment = await db.assessments.find_one({"id": request.assessment_id}, {"_id": 0})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        # Check if already paid
        if assessment['payment_status'] == 'paid':
            raise HTTPException(status_code=400, detail="Report already purchased")
        
        # Initialize Stripe
        host_url = request.origin_url
        webhook_url = f"{str(http_request.base_url)}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        # Create checkout session - Fixed amount £19.99
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
        
        # Create payment transaction record
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
        # Get transaction
        transaction = await db.payment_transactions.find_one(
            {"session_id": session_id}, 
            {"_id": 0}
        )
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Check Stripe status
        webhook_url = "placeholder"  # Not used for status check
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        status = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction status
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": status.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If paid, generate report
        if status.payment_status == "paid":
            assessment = await db.assessments.find_one(
                {"id": transaction['assessment_id']}, 
                {"_id": 0}
            )
            
            if assessment and assessment['payment_status'] != 'paid':
                # Generate AI report
                ai_content = await generate_ai_report(assessment)
                
                # Create PDF
                pdf_filename = create_pdf_report(assessment, ai_content)
                
                # Update assessment
                await db.assessments.update_one(
                    {"id": transaction['assessment_id']},
                    {"$set": {
                        "payment_status": "paid",
                        "pdf_path": pdf_filename
                    }}
                )
                
                # Send email (async, don't wait)
                asyncio.create_task(
                    send_email_with_pdf(
                        assessment['email'], 
                        assessment['id'], 
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
@api_router.post("/admin/login")
async def admin_login(request: AdminLoginRequest):
    """Admin login"""
    if request.password == ADMIN_PASSWORD:
        return {"success": True, "token": "admin_authenticated"}
    raise HTTPException(status_code=401, detail="Invalid password")

@api_router.get("/admin/assessments")
async def get_all_assessments(admin_token: Optional[str] = Header(None)):
    """Get all assessments (admin only)"""
    if admin_token != "admin_authenticated":
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    assessments = await db.assessments.find({}, {"_id": 0}).to_list(1000)
    return {"assessments": assessments, "total": len(assessments)}

@api_router.get("/admin/transactions")
async def get_all_transactions(admin_token: Optional[str] = Header(None)):
    """Get all payment transactions (admin only)"""
    if admin_token != "admin_authenticated":
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    transactions = await db.payment_transactions.find({}, {"_id": 0}).to_list(1000)
    return {"transactions": transactions, "total": len(transactions)}

@api_router.get("/admin/stats")
async def get_admin_stats(admin_token: Optional[str] = Header(None)):
    """Get admin dashboard stats"""
    if admin_token != "admin_authenticated":
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    total_assessments = await db.assessments.count_documents({})
    paid_assessments = await db.assessments.count_documents({"payment_status": "paid"})
    
    # Risk band breakdown
    low_risk = await db.assessments.count_documents({"risk_band": "LOW"})
    moderate_risk = await db.assessments.count_documents({"risk_band": "MODERATE"})
    high_risk = await db.assessments.count_documents({"risk_band": "HIGH"})
    
    # Revenue
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

# Include the router in the main app
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
