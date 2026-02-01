# HMRC Red-Flag Detector - Product Requirements Document

## Original Problem Statement
Build a production-ready SaaS web application called "HMRC Red-Flag Detector" - an automated HMRC risk-indicator for UK Self-Assessment taxpayers.

## Architecture

### Tech Stack
- **Frontend**: React with Tailwind CSS, Shadcn UI components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Stripe (test mode, via emergentintegrations)
- **AI**: OpenAI GPT-5.2 (via Emergent LLM key)
- **Email**: Brevo (configured, requires API key)
- **File Storage**: S3-compatible (configured) + local fallback
- **Design**: Professional dark theme

### Core Features
1. Tax assessment form with 14+ fields
2. Deterministic risk scoring engine (12+ indicators)
3. Risk bands: LOW (0-24), MODERATE (25-49), HIGH (50-100)
4. Stripe checkout for £19.99 PDF report
5. AI-powered PDF report generation
6. Admin dashboard with JWT authentication
7. Email delivery of reports

## What's Been Implemented

### December 2024
- ✅ Complete SaaS application with dark theme UI
- ✅ Tax assessment form with all required fields
- ✅ Deterministic HMRC risk scoring engine
- ✅ Risk score calculation with 12+ indicators
- ✅ Stripe payment integration (test mode)
- ✅ AI-powered PDF report generation
- ✅ Admin dashboard with JWT auth
- ✅ Full admin login system with registration

### Bug Fixes Applied
- ✅ Loss indicator logic: Only triggers when profit ≤ 0 OR loss_checkbox=true
- ✅ Data inconsistency detection: Flags when loss_checkbox=true but profit > 0
- ✅ Frontend validation: Blocks submission on data inconsistency
- ✅ Derived profit field: Read-only, computed from turnover - expenses
- ✅ Mileage display: Shows "X miles" not "£X.XX"
- ✅ High profit margin: Contextual note without risk points
- ✅ Legal safety language: "No predefined risk indicators were triggered"
- ✅ PDF uses persisted values (not recomputed)
- ✅ Added "What Could Increase HMRC Attention" educational section

## User Personas
1. **Self-employed freelancers** - Checking risk before filing
2. **Small business owners** - Understanding HMRC scrutiny patterns
3. **Tax preparers** - Quick risk screening for clients

## Core Requirements (Static)
- Secure web form for tax data entry
- Instant risk score calculation
- FREE tier: Risk band only
- PAID tier (£19.99): Full PDF report
- Legal disclaimer on all pages
- Admin dashboard for case management

## P0/P1/P2 Feature Backlog

### P0 (Critical) - DONE
- [x] Risk calculation engine
- [x] Payment integration
- [x] PDF generation
- [x] Admin dashboard

### P1 (Important)
- [ ] Brevo email integration (requires API key from user)
- [ ] S3 storage configuration (requires AWS credentials)
- [ ] Email verification flow

### P2 (Nice to Have)
- [ ] Multiple tax year comparison
- [ ] Risk trend analysis
- [ ] Export to accountant format
- [ ] White-label options

## Environment Variables Required
```
# Backend (.env)
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
EMERGENT_LLM_KEY=<provided>
STRIPE_API_KEY=<test key provided>
BREVO_API_KEY=<user needs to provide>
SENDER_EMAIL=noreply@hmrc-detector.com
JWT_SECRET_KEY=<generated>
S3_ENDPOINT_URL=<optional>
S3_ACCESS_KEY=<optional>
S3_SECRET_KEY=<optional>
S3_BUCKET_NAME=hmrc-reports
```

## API Endpoints
- POST /api/assessment/submit - Submit tax assessment
- GET /api/assessment/{id} - Get assessment details
- POST /api/checkout/create - Create Stripe checkout
- GET /api/checkout/status/{session_id} - Check payment status
- GET /api/report/download/{id} - Download PDF
- POST /api/admin/register - Register admin
- POST /api/admin/login - Admin login
- GET /api/admin/assessments - List all assessments
- GET /api/admin/stats - Dashboard stats

## Next Tasks
1. Configure Brevo API key for email delivery
2. Set up S3 credentials for cloud PDF storage
3. Test full payment flow with Stripe test cards
4. Add rate limiting for API endpoints
