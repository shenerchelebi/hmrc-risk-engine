from fastapi import FastAPI, APIRouter, HTTPException, Request, Header, Depends
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
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
SENDER_NAME = os.environ.get('SENDER_NAME', 'HMRC Risk Engine PRO')

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
# Use argon2 for password hashing (avoids bcrypt 4.x compatibility issues)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# PDF storage directory
PDF_DIR = ROOT_DIR / 'pdfs'
PDF_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI(title="HMRC Risk Engine PRO V2")

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

# ================================
# INDUSTRY CONFIGURATION V2
# ================================

INDUSTRY_CONFIG = {
    "phv_taxi": {
        "name": "PHV / Taxi / Uber",
        "expected_profit_margin": (5, 25),
        "normal_expense_ratio": (60, 85),
        "hmrc_sensitivities": [
            "High mileage claims without records",
            "Cash income underreporting",
            "Vehicle expense inflation"
        ],
        "motor_threshold": 50,  # Motor can be higher for taxi
        "travel_threshold": 15,
        "home_office_threshold": 5
    },
    "construction_cis": {
        "name": "Construction / CIS",
        "expected_profit_margin": (10, 35),
        "normal_expense_ratio": (50, 75),
        "hmrc_sensitivities": [
            "Subcontractor payments without CIS deductions",
            "Materials cost inflation",
            "Cash-in-hand payments"
        ],
        "motor_threshold": 30,
        "travel_threshold": 25,
        "home_office_threshold": 5
    },
    "cleaning": {
        "name": "Cleaning Services",
        "expected_profit_margin": (15, 40),
        "normal_expense_ratio": (45, 70),
        "hmrc_sensitivities": [
            "Equipment and supplies costs",
            "Travel between clients",
            "Cash payments"
        ],
        "motor_threshold": 35,
        "travel_threshold": 20,
        "home_office_threshold": 8
    },
    "retail": {
        "name": "Retail",
        "expected_profit_margin": (5, 30),
        "normal_expense_ratio": (55, 80),
        "hmrc_sensitivities": [
            "Stock valuation",
            "Cash sales reporting",
            "Personal use of stock"
        ],
        "motor_threshold": 20,
        "travel_threshold": 15,
        "home_office_threshold": 10
    },
    "consultant_it": {
        "name": "Consultant / IT",
        "expected_profit_margin": (30, 70),
        "normal_expense_ratio": (20, 55),
        "hmrc_sensitivities": [
            "IR35 status",
            "Home office claims",
            "Equipment depreciation"
        ],
        "motor_threshold": 20,
        "travel_threshold": 25,
        "home_office_threshold": 12
    },
    "other": {
        "name": "Other / General",
        "expected_profit_margin": (10, 40),
        "normal_expense_ratio": (45, 70),
        "hmrc_sensitivities": [
            "General expense patterns",
            "Record keeping quality"
        ],
        "motor_threshold": 35,
        "travel_threshold": 20,
        "home_office_threshold": 8
    }
}

# Pricing configuration
PRICING = {
    "v1_basic": 19.99,
    "v2_pro": 29.99
}

# ================================
# PYDANTIC MODELS V2
# ================================

class TaxFormInputV2(BaseModel):
    """V2 Tax Form with expanded fields"""
    # Base fields (V1)
    tax_year: str
    turnover: float
    total_expenses: float
    motor_costs: float = 0
    mileage_claimed: float = 0
    method: str = "actual"
    home_office_amount: float = 0
    phone_internet: float = 0
    travel_subsistence: float = 0
    marketing: float = 0
    loss_this_year: bool = False
    loss_last_year: bool = False
    email: EmailStr
    
    # V2: Industry
    industry: str = "other"
    
    # V2: Expanded income
    has_other_income: bool = False
    employment_income: float = 0
    rental_income: float = 0
    dividends_income: float = 0
    interest_income: float = 0
    has_foreign_income: bool = False
    foreign_income: float = 0
    
    # V2: Capital allowances
    has_capital_allowances: bool = False
    capital_allowances_amount: float = 0
    capital_allowances_method: str = "aia"  # "aia" or "wda"
    
    # V2: Loss carry-forward
    has_loss_carry_forward: bool = False
    loss_carry_forward_amount: float = 0
    
    # V2: Report type
    report_type: str = "v2_pro"  # "v1_basic" or "v2_pro"

class RiskIndicator(BaseModel):
    """Detailed risk indicator with transparency info"""
    id: str
    name: str
    triggered: bool
    points: int
    weight: str  # "low", "medium", "high"
    explanation: str
    hmrc_context: str
    documentation_tips: str

class TaxAssessmentV2(BaseModel):
    """V2 Assessment with full transparency"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    email: str
    tax_year: str
    industry: str
    industry_name: str
    
    # Financial data
    turnover: float
    total_expenses: float
    profit: float
    motor_costs: float
    mileage_claimed: float
    method: str
    home_office_amount: float
    phone_internet: float
    travel_subsistence: float
    marketing: float
    
    # Expanded income
    has_other_income: bool = False
    employment_income: float = 0
    rental_income: float = 0
    dividends_income: float = 0
    interest_income: float = 0
    has_foreign_income: bool = False
    foreign_income: float = 0
    total_other_income: float = 0
    
    # Capital allowances
    has_capital_allowances: bool = False
    capital_allowances_amount: float = 0
    capital_allowances_method: str = "aia"
    
    # Loss data
    loss_this_year: bool = False
    loss_last_year: bool = False
    has_loss_carry_forward: bool = False
    loss_carry_forward_amount: float = 0
    calculated_loss: bool = False
    has_data_inconsistency: bool = False
    
    # Ratios
    expense_ratio: float
    profit_ratio: float
    motor_ratio: float
    home_office_ratio: float
    travel_ratio: float
    mileage_value: float
    mileage_miles: float = 0
    
    # Risk assessment
    risk_score: int
    risk_band: str
    risk_indicators: List[Dict[str, Any]] = []
    contextual_notes: List[str] = []
    
    # Report & payment
    report_type: str = "v2_pro"
    payment_status: str = "pending"
    payment_amount: float = 29.99
    pdf_path: Optional[str] = None
    pdf_s3_key: Optional[str] = None
    
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserAccount(BaseModel):
    """Light user account for magic link auth"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    magic_token: Optional[str] = None
    magic_token_expires: Optional[str] = None
    is_verified: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_login: Optional[str] = None

class MagicLinkRequest(BaseModel):
    email: EmailStr

class MagicLinkVerify(BaseModel):
    token: str

class SimulationRequest(BaseModel):
    """Request for risk simulation (what-if analysis)"""
    assessment_id: str
    # Adjustable fields
    total_expenses: Optional[float] = None
    motor_costs: Optional[float] = None
    mileage_claimed: Optional[float] = None
    loss_this_year: Optional[bool] = None

class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    assessment_id: str
    user_id: Optional[str] = None
    email: str
    amount: float
    currency: str
    session_id: str
    payment_status: str
    report_type: str = "v2_pro"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CheckoutRequestV2(BaseModel):
    assessment_id: str
    origin_url: str
    report_type: str = "v2_pro"

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
    admin_secret: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

# ================================
# RISK ENGINE V2 - INDUSTRY AWARE
# ================================

def calculate_risk_score_v2(data: dict) -> tuple:
    """V2 Risk calculation with industry awareness and full transparency"""
    
    industry = data.get('industry', 'other')
    industry_config = INDUSTRY_CONFIG.get(industry, INDUSTRY_CONFIG['other'])
    
    risk_indicators = []
    contextual_notes = []
    total_score = 0
    
    turnover = data['turnover']
    expenses = data['total_expenses']
    motor_costs = data.get('motor_costs', 0)
    mileage = data.get('mileage_claimed', 0)
    home_office = data.get('home_office_amount', 0)
    travel = data.get('travel_subsistence', 0)
    method = data.get('method', 'actual')
    loss_checkbox = data.get('loss_this_year', False)
    loss_last_year = data.get('loss_last_year', False)
    
    # Calculate derived values
    profit = turnover - expenses
    calculated_loss = profit <= 0
    
    profit_ratio = (profit / turnover * 100) if turnover > 0 else 0
    expense_ratio = (expenses / turnover * 100) if turnover > 0 else 0
    motor_ratio = (motor_costs / turnover * 100) if turnover > 0 else 0
    home_office_ratio = (home_office / turnover * 100) if turnover > 0 else 0
    travel_ratio = (travel / turnover * 100) if turnover > 0 else 0
    mileage_value = mileage * 0.45
    mileage_value_ratio = (mileage_value / turnover * 100) if turnover > 0 else 0
    
    has_data_inconsistency = False
    
    # Get industry thresholds
    expected_profit_min, expected_profit_max = industry_config['expected_profit_margin']
    expected_expense_min, expected_expense_max = industry_config['normal_expense_ratio']
    motor_threshold = industry_config['motor_threshold']
    travel_threshold = industry_config['travel_threshold']
    home_office_threshold = industry_config['home_office_threshold']
    
    # ---- INDICATOR 1: Low Profit Margin ----
    if profit > 0:
        if profit_ratio < 5:
            points = 20
            total_score += points
            risk_indicators.append({
                "id": "low_profit_critical",
                "name": "Very Low Profit Margin",
                "triggered": True,
                "points": points,
                "weight": "high",
                "explanation": f"Your profit margin of {profit_ratio:.1f}% is below 5%, which is unusually low.",
                "hmrc_context": "HMRC flags very low profit margins as they may indicate unreported income or inflated expenses.",
                "documentation_tips": "Maintain detailed records of all income sources and expense receipts."
            })
        elif profit_ratio < expected_profit_min:
            points = 10
            total_score += points
            risk_indicators.append({
                "id": "low_profit_moderate",
                "name": "Below-Industry Profit Margin",
                "triggered": True,
                "points": points,
                "weight": "medium",
                "explanation": f"Your profit margin of {profit_ratio:.1f}% is below the typical {expected_profit_min}%-{expected_profit_max}% range for {industry_config['name']}.",
                "hmrc_context": "Profit margins significantly below industry norms may prompt HMRC to verify expense claims.",
                "documentation_tips": "Keep sector-specific records showing why margins may be lower (e.g., startup costs, market conditions)."
            })
        elif profit_ratio > 60:
            # High margin - contextual note only, no points
            contextual_notes.append(f"High profit margin ({profit_ratio:.1f}%): High profit margins may be normal depending on trade type. HMRC typically considers sector norms rather than margin alone.")
    
    # ---- INDICATOR 2: High Expense Ratio ----
    if expense_ratio > 70:
        points = 18
        total_score += points
        risk_indicators.append({
            "id": "high_expense_critical",
            "name": "Very High Expense Ratio",
            "triggered": True,
            "points": points,
            "weight": "high",
            "explanation": f"Your expenses represent {expense_ratio:.1f}% of turnover, which exceeds 70%.",
            "hmrc_context": "Expense ratios above 70% are routinely flagged for review as they leave minimal taxable profit.",
            "documentation_tips": "Ensure all expenses have supporting invoices, receipts, and clear business purpose documentation."
        })
    elif expense_ratio > expected_expense_max:
        points = 10
        total_score += points
        risk_indicators.append({
            "id": "high_expense_moderate",
            "name": "Above-Industry Expense Ratio",
            "triggered": True,
            "points": points,
            "weight": "medium",
            "explanation": f"Your expense ratio of {expense_ratio:.1f}% exceeds the typical {expected_expense_min}%-{expected_expense_max}% range for {industry_config['name']}.",
            "hmrc_context": "Expenses significantly above industry norms may be scrutinised for legitimacy.",
            "documentation_tips": "Document why your expenses may be higher (e.g., equipment investment, geographic factors)."
        })
    
    # ---- INDICATOR 3: Motor Costs ----
    if motor_ratio > motor_threshold:
        points = 12
        total_score += points
        risk_indicators.append({
            "id": "high_motor_costs",
            "name": "High Motor Costs",
            "triggered": True,
            "points": points,
            "weight": "medium",
            "explanation": f"Motor costs represent {motor_ratio:.1f}% of turnover, exceeding the {motor_threshold}% threshold for {industry_config['name']}.",
            "hmrc_context": "Motor expenses are commonly audited. HMRC looks for private vs business use allocation.",
            "documentation_tips": "Keep a mileage log distinguishing business from personal journeys. Retain all fuel receipts and service records."
        })
    
    # ---- INDICATOR 4: Mileage Value ----
    if mileage_value_ratio > 50:
        points = 15
        total_score += points
        risk_indicators.append({
            "id": "high_mileage_value",
            "name": "High Mileage Claim Value",
            "triggered": True,
            "points": points,
            "weight": "high",
            "explanation": f"Your mileage claim ({mileage:,.0f} miles = £{mileage_value:,.2f}) represents {mileage_value_ratio:.1f}% of turnover.",
            "hmrc_context": "Large mileage claims without contemporaneous records are a primary audit trigger.",
            "documentation_tips": "Maintain a detailed mileage log with dates, destinations, purposes, and odometer readings."
        })
    
    # ---- INDICATOR 5: Mileage + Motor Inconsistency ----
    if method.lower() == 'mileage' and motor_ratio > 10:
        points = 10
        total_score += points
        risk_indicators.append({
            "id": "mileage_motor_inconsistency",
            "name": "Mileage Method with High Motor Costs",
            "triggered": True,
            "points": points,
            "weight": "medium",
            "explanation": "You're using the mileage rate method but also claiming significant motor costs.",
            "hmrc_context": "Using mileage allowance while also claiming actual motor costs may indicate double-claiming.",
            "documentation_tips": "Choose one method consistently. If using mileage rate, you cannot also claim actual vehicle costs."
        })
    
    # ---- INDICATOR 6: Home Office ----
    if home_office_ratio > home_office_threshold:
        points = 8
        total_score += points
        risk_indicators.append({
            "id": "high_home_office",
            "name": "High Home Office Claims",
            "triggered": True,
            "points": points,
            "weight": "low",
            "explanation": f"Home office expenses represent {home_office_ratio:.1f}% of turnover, exceeding the {home_office_threshold}% threshold.",
            "hmrc_context": "Home office claims must reflect actual business use proportion, not total household costs.",
            "documentation_tips": "Calculate and document the business-use proportion of your home (floor area or time-based)."
        })
    
    # ---- INDICATOR 7: Travel & Subsistence ----
    if travel_ratio > travel_threshold:
        points = 10
        total_score += points
        risk_indicators.append({
            "id": "high_travel",
            "name": "High Travel & Subsistence",
            "triggered": True,
            "points": points,
            "weight": "medium",
            "explanation": f"Travel expenses represent {travel_ratio:.1f}% of turnover, exceeding the {travel_threshold}% threshold.",
            "hmrc_context": "Subsistence claims must be wholly and exclusively for business. Personal travel is not allowable.",
            "documentation_tips": "Keep receipts with notes on business purpose. Log client meetings and site visits."
        })
    
    # ---- INDICATOR 8: Loss This Year ----
    if calculated_loss:
        points = 12
        total_score += points
        risk_indicators.append({
            "id": "loss_this_year",
            "name": "Trading Loss Declared",
            "triggered": True,
            "points": points,
            "weight": "medium",
            "explanation": f"Your calculated figures show a loss of £{abs(profit):,.2f}.",
            "hmrc_context": "Trading losses attract scrutiny, especially if claimed against other income or carried forward.",
            "documentation_tips": "Document reasons for the loss (startup phase, market conditions, one-off costs)."
        })
        
        # ---- INDICATOR 9: Consecutive Losses ----
        if loss_last_year:
            points = 18
            total_score += points
            risk_indicators.append({
                "id": "consecutive_losses",
                "name": "Consecutive Year Losses",
                "triggered": True,
                "points": points,
                "weight": "high",
                "explanation": "You've declared losses in consecutive tax years.",
                "hmrc_context": "Persistent losses may indicate the activity is a hobby rather than a genuine trade.",
                "documentation_tips": "Demonstrate commercial intent: business plans, marketing efforts, genuine expectation of profit."
            })
    elif loss_checkbox and profit > 0:
        # Data inconsistency
        has_data_inconsistency = True
        points = 8
        total_score += points
        risk_indicators.append({
            "id": "data_inconsistency",
            "name": "Data Inconsistency Detected",
            "triggered": True,
            "points": points,
            "weight": "medium",
            "explanation": "You indicated a loss, but your figures show a profit.",
            "hmrc_context": "Inconsistencies between declarations and figures are flagged for verification.",
            "documentation_tips": "Ensure your declaration matches your actual financial position."
        })
    
    # ---- INDICATOR 10: Rounded Numbers ----
    rounded_count = 0
    values = [turnover, expenses, motor_costs, home_office, travel, data.get('marketing', 0)]
    for val in values:
        if val > 0 and (val % 1000 == 0 or val % 500 == 0):
            rounded_count += 1
    
    if rounded_count >= 3:
        points = 6
        total_score += points
        risk_indicators.append({
            "id": "rounded_numbers",
            "name": "Multiple Rounded Figures",
            "triggered": True,
            "points": points,
            "weight": "low",
            "explanation": f"Several figures ({rounded_count}) are round numbers ending in 000 or 500.",
            "hmrc_context": "Multiple rounded figures may suggest estimates rather than actual records.",
            "documentation_tips": "Use actual figures from receipts and bank statements, not estimates."
        })
    
    # ---- V2 INDICATORS ----
    
    # Foreign income
    if data.get('has_foreign_income') and data.get('foreign_income', 0) > 0:
        points = 8
        total_score += points
        risk_indicators.append({
            "id": "foreign_income",
            "name": "Foreign Income Declared",
            "triggered": True,
            "points": points,
            "weight": "medium",
            "explanation": f"You've declared foreign income of £{data.get('foreign_income', 0):,.2f}.",
            "hmrc_context": "Foreign income receives additional scrutiny for correct reporting and tax treaty compliance.",
            "documentation_tips": "Keep records of overseas income sources, any foreign tax paid, and exchange rate calculations."
        })
    
    # Capital allowances
    if data.get('has_capital_allowances') and data.get('capital_allowances_amount', 0) > turnover * 0.3:
        points = 6
        total_score += points
        risk_indicators.append({
            "id": "high_capital_allowances",
            "name": "High Capital Allowances",
            "triggered": True,
            "points": points,
            "weight": "low",
            "explanation": f"Capital allowances of £{data.get('capital_allowances_amount', 0):,.2f} exceed 30% of turnover.",
            "hmrc_context": "Large capital allowances may be queried for asset eligibility and correct method application.",
            "documentation_tips": "Retain purchase invoices and evidence of business use for all claimed assets."
        })
    
    # Loss carry-forward
    if data.get('has_loss_carry_forward') and data.get('loss_carry_forward_amount', 0) > 0:
        points = 5
        total_score += points
        risk_indicators.append({
            "id": "loss_carry_forward",
            "name": "Loss Carry-Forward Claimed",
            "triggered": True,
            "points": points,
            "weight": "low",
            "explanation": f"You're claiming a loss carry-forward of £{data.get('loss_carry_forward_amount', 0):,.2f}.",
            "hmrc_context": "Loss relief claims must have originated from genuine trading losses.",
            "documentation_tips": "Retain records from the original loss year showing how the loss arose."
        })
    
    # Transparency note for insufficient categorisation
    total_categorized = motor_costs + home_office + travel + data.get('phone_internet', 0) + data.get('marketing', 0)
    if expenses > 0 and total_categorized < expenses * 0.5:
        contextual_notes.append("Transparency note: Less than 50% of expenses are categorised. This is not treated as an HMRC risk indicator unless misclassification or inconsistency is detected.")
    
    # Cap score at 100
    total_score = min(total_score, 100)
    
    # Determine risk band
    if total_score <= 24:
        risk_band = "LOW"
    elif total_score <= 49:
        risk_band = "MODERATE"
    else:
        risk_band = "HIGH"
    
    # Calculate total other income
    total_other_income = sum([
        data.get('employment_income', 0),
        data.get('rental_income', 0),
        data.get('dividends_income', 0),
        data.get('interest_income', 0),
        data.get('foreign_income', 0)
    ])
    
    return total_score, risk_band, risk_indicators, {
        'profit': profit,
        'profit_ratio': round(profit_ratio, 2),
        'expense_ratio': round(expense_ratio, 2),
        'motor_ratio': round(motor_ratio, 2),
        'home_office_ratio': round(home_office_ratio, 2),
        'travel_ratio': round(travel_ratio, 2),
        'mileage_value': round(mileage_value, 2),
        'mileage_miles': mileage,
        'calculated_loss': calculated_loss,
        'has_data_inconsistency': has_data_inconsistency,
        'contextual_notes': contextual_notes,
        'total_other_income': total_other_income
    }

# ================================
# S3 & FILE STORAGE
# ================================

def get_s3_client():
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
    try:
        s3_client = get_s3_client()
        if not s3_client:
            return False
        s3_client.put_object(Bucket=S3_BUCKET_NAME, Key=file_key, Body=file_content, ContentType='application/pdf')
        return True
    except ClientError as e:
        logger.error(f"S3 upload error: {str(e)}")
        return False

async def get_from_s3(file_key: str) -> Optional[bytes]:
    try:
        s3_client = get_s3_client()
        if not s3_client:
            return None
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=file_key)
        return response['Body'].read()
    except ClientError as e:
        logger.error(f"S3 download error: {str(e)}")
        return None

# ================================
# JWT & AUTH HELPERS
# ================================

def create_access_token(data: dict, expires_hours: int = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=expires_hours or JWT_EXPIRATION_HOURS)
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

async def get_current_user_optional(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[dict]:
    """Optional user auth - returns None if not authenticated"""
    if not credentials:
        return None
    payload = verify_token(credentials.credentials)
    if not payload or payload.get("type") != "user":
        return None
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
    return user

# ================================
# AI REPORT GENERATION V2
# ================================

async def generate_ai_report_v2(assessment: dict) -> str:
    """V2 AI report with industry context and full transparency"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    industry_config = INDUSTRY_CONFIG.get(assessment.get('industry', 'other'), INDUSTRY_CONFIG['other'])
    
    profit = assessment['profit']
    risk_score = assessment['risk_score']
    risk_band = assessment['risk_band']
    risk_indicators = assessment.get('risk_indicators', [])
    contextual_notes = assessment.get('contextual_notes', [])
    mileage_miles = assessment.get('mileage_miles', 0)
    
    if profit <= 0:
        profit_status = f"Loss of £{abs(profit):,.2f}"
    else:
        profit_status = f"Profit of £{profit:,.2f}"
    
    # Build triggered indicators section
    triggered = [ind for ind in risk_indicators if ind.get('triggered')]
    if len(triggered) == 0:
        executive_guidance = "No predefined risk indicators were triggered based on the figures provided and the current rule set."
        indicators_text = "None triggered"
    else:
        executive_guidance = f"{len(triggered)} risk indicator(s) were identified. Review the detailed analysis below."
        indicators_text = "\n".join([f"- {ind['name']}: {ind['explanation']}" for ind in triggered])
    
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"report-v2-{assessment['id']}",
        system_message="""You are a UK tax compliance analyst generating a professional HMRC risk assessment report.

CRITICAL RULES:
- Use ONLY the exact risk score, band, and indicators provided
- Do NOT provide tax advice
- Use neutral, defensive language
- Never claim "HMRC will not investigate" - say "no predefined indicators triggered"
- Include industry context throughout
- For mileage, always express as miles not pounds
- This is informational only, not advisory"""
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Generate a professional HMRC Risk Assessment Report V2.

TAXPAYER DATA:
- Tax Year: {assessment['tax_year']}
- Industry: {assessment.get('industry_name', 'General')}
- Turnover: £{assessment['turnover']:,.2f}
- Total Expenses: £{assessment['total_expenses']:,.2f}
- Financial Result: {profit_status}
- Profit Margin: {assessment['profit_ratio']}%
- Mileage Claimed: {mileage_miles:,.0f} miles

INDUSTRY CONTEXT:
- Expected profit margin for {assessment.get('industry_name', 'this sector')}: {industry_config['expected_profit_margin'][0]}%-{industry_config['expected_profit_margin'][1]}%
- Normal expense ratio: {industry_config['normal_expense_ratio'][0]}%-{industry_config['normal_expense_ratio'][1]}%
- Known HMRC sensitivities: {', '.join(industry_config['hmrc_sensitivities'])}

RISK ASSESSMENT (use these exact values):
- Risk Score: {risk_score}/100
- Risk Band: {risk_band}

TRIGGERED INDICATORS:
{indicators_text}

CONTEXTUAL NOTES:
{chr(10).join(['- ' + note for note in contextual_notes]) if contextual_notes else 'None'}

Generate the report with these sections:
1. EXECUTIVE SUMMARY (Start with: "{executive_guidance}")
2. INDUSTRY CONTEXT (How your figures compare to {assessment.get('industry_name', 'industry')} norms)
3. RISK INDICATOR ANALYSIS (Detail each triggered indicator with HMRC context and documentation tips)
4. WHAT HMRC TYPICALLY EXAMINES (For similar cases in {assessment.get('industry_name', 'this sector')})
5. RECORD-KEEPING CHECKLIST (Industry-specific)
6. WHAT COULD INCREASE HMRC ATTENTION IN FUTURE YEARS (Educational: sudden changes, consecutive losses, incomplete records, large fluctuations)

Use the exact risk score ({risk_score}) and band ({risk_band}). This is NOT tax advice."""

    user_message = UserMessage(text=prompt)
    response = await chat.send_message(user_message)
    return response

# ================================
# PDF GENERATION V2
# ================================

def create_pdf_report_v2(assessment: dict, ai_content: str) -> tuple:
    """V2 PDF with full transparency panel and industry context"""
    pdf_filename = f"hmrc_risk_report_v2_{assessment['id']}.pdf"
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, 
                           rightMargin=60, leftMargin=60, 
                           topMargin=60, bottomMargin=60)
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=22, spaceAfter=20, textColor=colors.HexColor('#0f172a'))
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=13, spaceBefore=15, spaceAfter=8, textColor=colors.HexColor('#0f172a'))
    subheading_style = ParagraphStyle('SubHeading', parent=styles['Heading3'], fontSize=11, spaceBefore=10, spaceAfter=6, textColor=colors.HexColor('#374151'))
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, spaceAfter=8, leading=13)
    small_style = ParagraphStyle('Small', parent=styles['Normal'], fontSize=9, spaceAfter=6, leading=11, textColor=colors.HexColor('#6b7280'))
    indicator_style = ParagraphStyle('Indicator', parent=styles['Normal'], fontSize=10, spaceAfter=4, leading=12, leftIndent=15)
    warning_style = ParagraphStyle('Warning', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#b45309'), backColor=colors.HexColor('#fef3c7'), borderPadding=6)
    disclaimer_style = ParagraphStyle('Disclaimer', parent=styles['Normal'], fontSize=8, textColor=colors.gray, spaceAfter=4)
    
    elements = []
    
    # Header
    elements.append(Paragraph("HMRC Risk Assessment Report", title_style))
    elements.append(Paragraph("Professional V2 Analysis", small_style))
    elements.append(Spacer(1, 10))
    
    # Use persisted values
    profit = assessment['profit']
    risk_score = assessment['risk_score']
    risk_band = assessment['risk_band']
    risk_indicators = assessment.get('risk_indicators', [])
    industry_name = assessment.get('industry_name', 'General')
    mileage_miles = assessment.get('mileage_miles', 0)
    
    profit_display = f"Loss: £{abs(profit):,.2f}" if profit <= 0 else f"Profit: £{profit:,.2f}"
    
    # Summary Table
    summary_data = [
        ['Tax Year:', assessment['tax_year'], 'Industry:', industry_name],
        ['Turnover:', f"£{assessment['turnover']:,.2f}", 'Risk Score:', f"{risk_score}/100"],
        ['Expenses:', f"£{assessment['total_expenses']:,.2f}", 'Risk Band:', risk_band],
        ['Result:', profit_display, 'Mileage:', f"{mileage_miles:,.0f} miles"],
    ]
    
    summary_table = Table(summary_data, colWidths=[1.2*inch, 1.5*inch, 1.2*inch, 1.5*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1e293b')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 15))
    
    # Data inconsistency warning
    if assessment.get('has_data_inconsistency'):
        elements.append(Paragraph("⚠ Data Inconsistency: Loss checkbox selected but figures show profit.", warning_style))
        elements.append(Spacer(1, 8))
    
    # Risk Indicators Panel - TRANSPARENCY
    elements.append(Paragraph("What Affected Your Score", heading_style))
    
    triggered = [ind for ind in risk_indicators if ind.get('triggered')]
    if not triggered:
        elements.append(Paragraph("No predefined risk indicators were triggered based on the figures provided and the current rule set.", body_style))
    else:
        for ind in triggered:
            weight_color = {'high': '#dc2626', 'medium': '#d97706', 'low': '#059669'}.get(ind.get('weight', 'low'), '#6b7280')
            elements.append(Paragraph(f"<b>{ind['name']}</b> ({ind.get('weight', 'low').title()} weight, +{ind['points']} points)", subheading_style))
            elements.append(Paragraph(f"• {ind['explanation']}", indicator_style))
            elements.append(Paragraph(f"• HMRC Context: {ind.get('hmrc_context', 'N/A')}", indicator_style))
            elements.append(Paragraph(f"• Documentation: {ind.get('documentation_tips', 'N/A')}", indicator_style))
            elements.append(Spacer(1, 6))
    
    # Contextual notes
    contextual_notes = assessment.get('contextual_notes', [])
    if contextual_notes:
        elements.append(Paragraph("Contextual Notes", heading_style))
        for note in contextual_notes:
            elements.append(Paragraph(f"• {note}", small_style))
    
    elements.append(Spacer(1, 10))
    
    # AI Content
    elements.append(Paragraph("Detailed Analysis", heading_style))
    for para in ai_content.split('\n\n'):
        if para.strip():
            clean = para.replace('**', '').replace('- ', '• ').strip()
            if clean.startswith('# '):
                elements.append(Paragraph(clean[2:], heading_style))
            elif clean.startswith('## '):
                elements.append(Paragraph(clean[3:], subheading_style))
            else:
                elements.append(Paragraph(clean, body_style))
    
    # Future Attention Section
    elements.append(Spacer(1, 15))
    elements.append(Paragraph("What Could Increase HMRC Attention in Future Years", heading_style))
    elements.append(Paragraph("The following factors may increase scrutiny in future tax years (for educational purposes only):", body_style))
    future_items = [
        "Sudden changes in expense ratios year-on-year",
        "Consecutive years of declared losses",
        "Incomplete or missing mileage records",
        "Large fluctuations in turnover without clear explanation",
        "Significant changes in profit margins",
        "Inconsistencies between declared figures and supporting documentation"
    ]
    for item in future_items:
        elements.append(Paragraph(f"• {item}", indicator_style))
    
    # Disclaimer
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("Important Legal Notice", heading_style))
    elements.append(Paragraph(
        "This tool provides an automated risk indicator based on user-entered figures and public statistical patterns. "
        "It does not provide tax advice and does not submit or amend tax returns. Users should consult a qualified tax "
        "professional for specific advice regarding their tax affairs.",
        disclaimer_style
    ))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(f"Report generated: {datetime.now(timezone.utc).strftime('%d %B %Y at %H:%M UTC')}", disclaimer_style))
    elements.append(Paragraph(f"Reference: {assessment['id']}", disclaimer_style))
    
    doc.build(elements)
    pdf_content = buffer.getvalue()
    buffer.close()
    
    return pdf_filename, pdf_content

# ================================
# EMAIL SENDING
# ================================

async def send_email_with_brevo(email: str, assessment_id: str, pdf_content: bytes, pdf_filename: str):
    """Send email with PDF attachment using Brevo API"""
    try:
        if not BREVO_API_KEY or BREVO_API_KEY == 'placeholder_brevo_key':
            logger.warning("Brevo API key not configured")
            return False
        
        pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
        
        payload = {
            "sender": {"name": SENDER_NAME, "email": SENDER_EMAIL},
            "to": [{"email": email}],
            "subject": "Your HMRC Risk Assessment Report V2",
            "htmlContent": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px;">
                <h1 style="color: #2dd4bf;">Your HMRC Risk Assessment Report</h1>
                <p>Thank you for using HMRC Risk Engine PRO.</p>
                <p>Your detailed risk assessment report is attached.</p>
                <p><strong>Reference:</strong> {assessment_id}</p>
                <hr style="border-color: #334155; margin: 20px 0;">
                <p style="color: #94a3b8; font-size: 12px;">This tool provides automated risk indicators only. It does not provide tax advice.</p>
            </div>
            """,
            "attachment": [{"name": pdf_filename, "content": pdf_base64}]
        }
        
        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            json=payload,
            headers={"accept": "application/json", "api-key": BREVO_API_KEY, "content-type": "application/json"},
            timeout=30
        )
        return response.status_code in [200, 201]
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        return False

async def send_magic_link_email(email: str, magic_link: str):
    """Send magic link login email"""
    try:
        if not BREVO_API_KEY or BREVO_API_KEY == 'placeholder_brevo_key':
            logger.warning("Brevo not configured - magic link: " + magic_link)
            return False
        
        payload = {
            "sender": {"name": SENDER_NAME, "email": SENDER_EMAIL},
            "to": [{"email": email}],
            "subject": "Your HMRC Risk Engine Login Link",
            "htmlContent": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px;">
                <h1 style="color: #2dd4bf;">Login to HMRC Risk Engine PRO</h1>
                <p>Click the button below to access your account:</p>
                <a href="{magic_link}" style="display: inline-block; background: #0d9488; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0;">Login Now</a>
                <p style="color: #94a3b8; font-size: 12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
            </div>
            """
        }
        
        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            json=payload,
            headers={"accept": "application/json", "api-key": BREVO_API_KEY, "content-type": "application/json"},
            timeout=30
        )
        return response.status_code in [200, 201]
    except Exception as e:
        logger.error(f"Magic link email error: {str(e)}")
        return False

# ================================
# API ROUTES
# ================================

@api_router.get("/")
async def root():
    return {"message": "HMRC Risk Engine PRO V2 API", "version": "2.0", "status": "active"}

@api_router.get("/industries")
async def get_industries():
    """Get available industries with their configurations"""
    return {
        "industries": [
            {"id": k, "name": v["name"], "expected_profit_margin": v["expected_profit_margin"], "normal_expense_ratio": v["normal_expense_ratio"]}
            for k, v in INDUSTRY_CONFIG.items()
        ]
    }

@api_router.get("/pricing")
async def get_pricing():
    """Get pricing information"""
    return {
        "plans": [
            {"id": "v1_basic", "name": "Basic Report", "price": PRICING["v1_basic"], "currency": "gbp", "features": ["Risk score", "Risk band", "Basic indicators"]},
            {"id": "v2_pro", "name": "PRO Report", "price": PRICING["v2_pro"], "currency": "gbp", "features": ["Full risk analysis", "Industry comparison", "Detailed indicators", "Documentation tips", "Year comparison"]}
        ]
    }

# ---- USER ACCOUNT ROUTES ----

@api_router.post("/auth/magic-link")
async def request_magic_link(request: MagicLinkRequest):
    """Request a magic link for passwordless login"""
    email = request.email.lower()
    
    # Find or create user
    user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if not user:
        user = UserAccount(email=email).model_dump()
        await db.users.insert_one(user)
    
    # Generate magic token
    magic_token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    
    await db.users.update_one(
        {"email": email},
        {"$set": {"magic_token": magic_token, "magic_token_expires": expires}}
    )
    
    # In production, send email. For now, return token for testing
    magic_link = f"https://taxscan-4.preview.emergentagent.com/auth/verify?token={magic_token}"
    
    email_sent = await send_magic_link_email(email, magic_link)
    
    return {
        "success": True,
        "message": "Magic link sent to your email" if email_sent else "Magic link generated (email not configured)",
        "token": magic_token if not email_sent else None  # Only return token if email failed
    }

@api_router.post("/auth/verify")
async def verify_magic_link(request: MagicLinkVerify):
    """Verify magic link and return access token"""
    user = await db.users.find_one({"magic_token": request.token}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired link")
    
    # Check expiry
    expires = datetime.fromisoformat(user['magic_token_expires'].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=401, detail="Link has expired")
    
    # Clear magic token and update login
    await db.users.update_one(
        {"id": user['id']},
        {
            "$set": {
                "magic_token": None,
                "magic_token_expires": None,
                "is_verified": True,
                "last_login": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Generate access token
    access_token = create_access_token({"sub": user['id'], "email": user['email'], "type": "user"}, expires_hours=168)  # 1 week
    
    return TokenResponse(access_token=access_token, expires_in=168 * 3600)

@api_router.get("/user/assessments")
async def get_user_assessments(user: dict = Depends(get_current_user_optional)):
    """Get user's assessment history"""
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    
    assessments = await db.assessments_v2.find(
        {"user_id": user['id']},
        {"_id": 0, "id": 1, "tax_year": 1, "industry_name": 1, "risk_score": 1, "risk_band": 1, "payment_status": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(100)
    
    return {"assessments": assessments}

# ---- ASSESSMENT ROUTES ----

@api_router.post("/assessment/submit")
async def submit_assessment_v2(form_data: TaxFormInputV2, user: dict = Depends(get_current_user_optional)):
    """V2 Assessment submission with industry awareness"""
    try:
        data = form_data.model_dump()
        score, risk_band, risk_indicators, calculations = calculate_risk_score_v2(data)
        
        industry_config = INDUSTRY_CONFIG.get(form_data.industry, INDUSTRY_CONFIG['other'])
        
        assessment = TaxAssessmentV2(
            user_id=user['id'] if user else None,
            email=form_data.email,
            tax_year=form_data.tax_year,
            industry=form_data.industry,
            industry_name=industry_config['name'],
            turnover=form_data.turnover,
            total_expenses=form_data.total_expenses,
            profit=calculations['profit'],
            motor_costs=form_data.motor_costs,
            mileage_claimed=form_data.mileage_claimed,
            method=form_data.method,
            home_office_amount=form_data.home_office_amount,
            phone_internet=form_data.phone_internet,
            travel_subsistence=form_data.travel_subsistence,
            marketing=form_data.marketing,
            has_other_income=form_data.has_other_income,
            employment_income=form_data.employment_income,
            rental_income=form_data.rental_income,
            dividends_income=form_data.dividends_income,
            interest_income=form_data.interest_income,
            has_foreign_income=form_data.has_foreign_income,
            foreign_income=form_data.foreign_income,
            total_other_income=calculations['total_other_income'],
            has_capital_allowances=form_data.has_capital_allowances,
            capital_allowances_amount=form_data.capital_allowances_amount,
            capital_allowances_method=form_data.capital_allowances_method,
            loss_this_year=form_data.loss_this_year,
            loss_last_year=form_data.loss_last_year,
            has_loss_carry_forward=form_data.has_loss_carry_forward,
            loss_carry_forward_amount=form_data.loss_carry_forward_amount,
            calculated_loss=calculations['calculated_loss'],
            has_data_inconsistency=calculations['has_data_inconsistency'],
            expense_ratio=calculations['expense_ratio'],
            profit_ratio=calculations['profit_ratio'],
            motor_ratio=calculations['motor_ratio'],
            home_office_ratio=calculations['home_office_ratio'],
            travel_ratio=calculations['travel_ratio'],
            mileage_value=calculations['mileage_value'],
            mileage_miles=calculations['mileage_miles'],
            risk_score=score,
            risk_band=risk_band,
            risk_indicators=risk_indicators,
            contextual_notes=calculations['contextual_notes'],
            report_type=form_data.report_type,
            payment_amount=PRICING.get(form_data.report_type, PRICING['v2_pro'])
        )
        
        doc = assessment.model_dump()
        await db.assessments_v2.insert_one(doc)
        
        return {
            "success": True,
            "assessment_id": assessment.id,
            "risk_score": score,
            "risk_band": risk_band,
            "industry": assessment.industry_name,
            "triggered_count": len([i for i in risk_indicators if i.get('triggered')]),
            "has_data_inconsistency": calculations['has_data_inconsistency']
        }
    except Exception as e:
        logger.error(f"Assessment error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/assessment/{assessment_id}")
async def get_assessment(assessment_id: str):
    """Get full assessment details"""
    assessment = await db.assessments_v2.find_one({"id": assessment_id}, {"_id": 0})
    if not assessment:
        # Try legacy collection
        assessment = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment

@api_router.post("/assessment/simulate")
async def simulate_risk(request: SimulationRequest):
    """Simulate risk score changes without saving"""
    assessment = await db.assessments_v2.find_one({"id": request.assessment_id}, {"_id": 0})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Create modified data for simulation
    sim_data = {
        'turnover': assessment['turnover'],
        'total_expenses': request.total_expenses if request.total_expenses is not None else assessment['total_expenses'],
        'motor_costs': request.motor_costs if request.motor_costs is not None else assessment['motor_costs'],
        'mileage_claimed': request.mileage_claimed if request.mileage_claimed is not None else assessment['mileage_claimed'],
        'method': assessment['method'],
        'home_office_amount': assessment['home_office_amount'],
        'phone_internet': assessment['phone_internet'],
        'travel_subsistence': assessment['travel_subsistence'],
        'marketing': assessment['marketing'],
        'loss_this_year': request.loss_this_year if request.loss_this_year is not None else assessment['loss_this_year'],
        'loss_last_year': assessment['loss_last_year'],
        'industry': assessment['industry'],
        'has_foreign_income': assessment.get('has_foreign_income', False),
        'foreign_income': assessment.get('foreign_income', 0),
        'has_capital_allowances': assessment.get('has_capital_allowances', False),
        'capital_allowances_amount': assessment.get('capital_allowances_amount', 0),
        'has_loss_carry_forward': assessment.get('has_loss_carry_forward', False),
        'loss_carry_forward_amount': assessment.get('loss_carry_forward_amount', 0),
    }
    
    score, band, indicators, calculations = calculate_risk_score_v2(sim_data)
    
    return {
        "simulated": True,
        "original_score": assessment['risk_score'],
        "original_band": assessment['risk_band'],
        "simulated_score": score,
        "simulated_band": band,
        "score_change": score - assessment['risk_score'],
        "triggered_indicators": [i for i in indicators if i.get('triggered')],
        "calculations": calculations
    }

# ---- PAYMENT ROUTES ----

@api_router.post("/checkout/create")
async def create_checkout_session(request: CheckoutRequestV2, http_request: Request):
    """Create Stripe checkout session"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    try:
        assessment = await db.assessments_v2.find_one({"id": request.assessment_id}, {"_id": 0})
        if not assessment:
            assessment = await db.assessments.find_one({"id": request.assessment_id}, {"_id": 0})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        if assessment.get('payment_status') == 'paid':
            raise HTTPException(status_code=400, detail="Report already purchased")
        
        amount = PRICING.get(request.report_type, PRICING['v2_pro'])
        
        webhook_url = f"{str(http_request.base_url)}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        checkout_request = CheckoutSessionRequest(
            amount=amount,
            currency="gbp",
            success_url=f"{request.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{request.origin_url}/results/{request.assessment_id}",
            metadata={"assessment_id": request.assessment_id, "email": assessment['email'], "report_type": request.report_type}
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        transaction = PaymentTransaction(
            assessment_id=request.assessment_id,
            user_id=assessment.get('user_id'),
            email=assessment['email'],
            amount=amount,
            currency="gbp",
            session_id=session.session_id,
            payment_status="initiated",
            report_type=request.report_type
        )
        await db.payment_transactions.insert_one(transaction.model_dump())
        
        return {"checkout_url": session.url, "session_id": session.session_id, "amount": amount}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Checkout error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/checkout/status/{session_id}")
async def check_payment_status(session_id: str):
    """Check payment status and generate report if paid"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    try:
        transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="placeholder")
        status = await stripe_checkout.get_checkout_status(session_id)
        
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": status.payment_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if status.payment_status == "paid":
            # Try V2 collection first
            assessment = await db.assessments_v2.find_one({"id": transaction['assessment_id']}, {"_id": 0})
            collection = "assessments_v2"
            if not assessment:
                assessment = await db.assessments.find_one({"id": transaction['assessment_id']}, {"_id": 0})
                collection = "assessments"
            
            if assessment and assessment.get('payment_status') != 'paid':
                # Generate report
                ai_content = await generate_ai_report_v2(assessment)
                pdf_filename, pdf_content = create_pdf_report_v2(assessment, ai_content)
                
                # Upload to S3 and save locally
                s3_key = f"reports/{assessment['id']}/{pdf_filename}"
                await upload_to_s3(pdf_content, s3_key)
                
                local_path = PDF_DIR / pdf_filename
                with open(local_path, 'wb') as f:
                    f.write(pdf_content)
                
                # Update assessment
                await db[collection].update_one(
                    {"id": transaction['assessment_id']},
                    {"$set": {"payment_status": "paid", "pdf_path": pdf_filename, "pdf_s3_key": s3_key}}
                )
                
                # Send email
                asyncio.create_task(send_email_with_brevo(assessment['email'], assessment['id'], pdf_content, pdf_filename))
                
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
        logger.error(f"Payment status error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/report/download/{assessment_id}")
async def download_report(assessment_id: str):
    """Download PDF report"""
    assessment = await db.assessments_v2.find_one({"id": assessment_id}, {"_id": 0})
    if not assessment:
        assessment = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if assessment.get('payment_status') != 'paid':
        raise HTTPException(status_code=403, detail="Report not purchased")
    
    # Try S3 first
    if assessment.get('pdf_s3_key'):
        pdf_content = await get_from_s3(assessment['pdf_s3_key'])
        if pdf_content:
            return StreamingResponse(
                BytesIO(pdf_content),
                media_type='application/pdf',
                headers={'Content-Disposition': f'attachment; filename="HMRC_Risk_Report_{assessment["tax_year"]}.pdf"'}
            )
    
    # Fallback to local
    if not assessment.get('pdf_path'):
        raise HTTPException(status_code=404, detail="Report not generated")
    
    pdf_path = PDF_DIR / assessment['pdf_path']
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Report file not found")
    
    return FileResponse(str(pdf_path), media_type='application/pdf', filename=f"HMRC_Risk_Report_{assessment['tax_year']}.pdf")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature", "")
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=str(request.url))
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        return {"status": "received"}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"status": "error"}

# ---- ADMIN ROUTES ----

@api_router.post("/admin/register")
async def admin_register(request: AdminRegisterRequest):
    if request.admin_secret != "hmrc-admin-secret-2024":
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    
    existing = await db.admin_users.find_one({"username": request.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username exists")
    
    admin = AdminUser(username=request.username, email=request.email, password_hash=pwd_context.hash(request.password))
    await db.admin_users.insert_one(admin.model_dump())
    return {"success": True}

@api_router.post("/admin/login", response_model=TokenResponse)
async def admin_login(request: AdminLoginRequest):
    admin = await db.admin_users.find_one({"username": request.username}, {"_id": 0})
    if not admin or not pwd_context.verify(request.password, admin['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": admin['id'], "username": admin['username']})
    return TokenResponse(access_token=token, expires_in=JWT_EXPIRATION_HOURS * 3600)

@api_router.get("/admin/me")
async def admin_me(admin: dict = Depends(get_current_admin)):
    return {"id": admin['id'], "username": admin['username'], "email": admin['email']}

@api_router.get("/admin/assessments")
async def get_all_assessments(industry: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    """Get all assessments with optional industry filter"""
    query = {}
    if industry:
        query["industry"] = industry
    
    # Get from both collections
    v2_assessments = await db.assessments_v2.find(query, {"_id": 0}).to_list(1000)
    v1_assessments = await db.assessments.find({}, {"_id": 0}).to_list(1000)
    
    all_assessments = v2_assessments + v1_assessments
    return {"assessments": all_assessments, "total": len(all_assessments)}

@api_router.get("/admin/stats")
async def get_admin_stats(admin: dict = Depends(get_current_admin)):
    """Enhanced admin stats with industry breakdown and indicator stats"""
    
    # V2 stats
    total_v2 = await db.assessments_v2.count_documents({})
    paid_v2 = await db.assessments_v2.count_documents({"payment_status": "paid"})
    
    # V1 stats
    total_v1 = await db.assessments.count_documents({})
    paid_v1 = await db.assessments.count_documents({"payment_status": "paid"})
    
    total = total_v2 + total_v1
    paid = paid_v2 + paid_v1
    
    # Risk breakdown
    low = await db.assessments_v2.count_documents({"risk_band": "LOW"}) + await db.assessments.count_documents({"risk_band": "LOW"})
    moderate = await db.assessments_v2.count_documents({"risk_band": "MODERATE"}) + await db.assessments.count_documents({"risk_band": "MODERATE"})
    high = await db.assessments_v2.count_documents({"risk_band": "HIGH"}) + await db.assessments.count_documents({"risk_band": "HIGH"})
    
    # Industry breakdown (V2 only)
    industry_stats = {}
    for industry_id, industry_config in INDUSTRY_CONFIG.items():
        count = await db.assessments_v2.count_documents({"industry": industry_id})
        industry_stats[industry_id] = {"name": industry_config['name'], "count": count}
    
    # Most triggered indicators (V2 only)
    indicator_counts = {}
    v2_assessments = await db.assessments_v2.find({}, {"risk_indicators": 1}).to_list(1000)
    for a in v2_assessments:
        for ind in a.get('risk_indicators', []):
            if ind.get('triggered'):
                name = ind.get('name', 'Unknown')
                indicator_counts[name] = indicator_counts.get(name, 0) + 1
    
    top_indicators = sorted(indicator_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # Revenue
    paid_transactions = await db.payment_transactions.count_documents({"payment_status": "paid"})
    
    # Calculate revenue from transactions
    transactions = await db.payment_transactions.find({"payment_status": "paid"}, {"amount": 1}).to_list(1000)
    total_revenue = sum(t.get('amount', 19.99) for t in transactions)
    
    return {
        "total_assessments": total,
        "v2_assessments": total_v2,
        "v1_assessments": total_v1,
        "paid_assessments": paid,
        "conversion_rate": round((paid / total * 100) if total > 0 else 0, 2),
        "risk_breakdown": {"low": low, "moderate": moderate, "high": high},
        "industry_breakdown": industry_stats,
        "top_indicators": [{"name": name, "count": count} for name, count in top_indicators],
        "total_revenue": round(total_revenue, 2)
    }

@api_router.get("/admin/transactions")
async def get_all_transactions(admin: dict = Depends(get_current_admin)):
    transactions = await db.payment_transactions.find({}, {"_id": 0}).to_list(1000)
    return {"transactions": transactions, "total": len(transactions)}

# Include router
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
