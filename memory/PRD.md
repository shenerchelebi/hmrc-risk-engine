# HMRC Red-Flag Detector PRO - Product Requirements Document

## Original Problem Statement
Build a production-ready SaaS web application called "HMRC Red-Flag Detector" - an automated HMRC risk-indicator for UK Self-Assessment taxpayers.

**V2 Requirements (HMRC Risk Engine PRO):**
- Expanded inputs (other income types, capital allowances, loss carry-forward)
- Industry-aware risk logic with mandatory industry selector
- Risk transparency panel explaining contributing factors
- Risk simulation tool (what-if analysis)
- Upgraded PDF report with industry context
- Light user accounts (magic link login)
- New pricing: £29.99 (V2 PRO)

## Architecture

### Tech Stack
- **Frontend**: React with Tailwind CSS, Shadcn UI components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Stripe (test mode, via emergentintegrations)
- **AI**: OpenAI GPT-5.2 (via Emergent LLM key)
- **Email**: Brevo (configured, requires API key)
- **File Storage**: S3-compatible (configured) + local fallback
- **Password Hashing**: Passlib with Argon2 (migrated from bcrypt)
- **Design**: Professional dark theme

### Core Features
1. Tax assessment form with 14+ fields + V2 expanded fields
2. Industry-aware risk scoring engine (12+ indicators)
3. Risk bands: LOW (0-24), MODERATE (25-49), HIGH (50-100)
4. Stripe checkout for £29.99 V2 PRO report
5. AI-powered PDF report generation
6. Admin dashboard with JWT authentication
7. Email delivery of reports
8. Risk simulation tool (what-if analysis)
9. Magic link user authentication

## What's Been Implemented

### December 2024
- ✅ Complete V1 SaaS application with dark theme UI
- ✅ Tax assessment form with all required fields
- ✅ Deterministic HMRC risk scoring engine
- ✅ Risk score calculation with 12+ indicators
- ✅ Stripe payment integration (test mode)
- ✅ AI-powered PDF report generation
- ✅ Admin dashboard with JWT auth
- ✅ Full admin login system with registration
- ✅ V2 Industry-aware risk logic
- ✅ V2 Risk transparency panel
- ✅ V2 Risk simulation API (working and tested)
- ✅ V2 Expanded inputs (other income, capital allowances, loss carry-forward)
- ✅ Preview mode for ResultsPage (bypass payment for UI testing)
- ✅ PHV/mileage tooltip rule (industry-specific contextual note)

### Bug Fixes Applied
- ✅ Loss indicator logic: Only triggers when profit ≤ 0 OR loss_checkbox=true
- ✅ Data inconsistency detection: Flags when loss_checkbox=true but profit > 0
- ✅ Frontend validation: Blocks submission on data inconsistency
- ✅ Derived profit field: Read-only, computed from turnover - expenses
- ✅ Mileage display: Shows "X miles" not "£X.XX"
- ✅ High profit margin: Contextual note without risk points
- ✅ Legal safety language: "No predefined risk indicators were triggered"
- ✅ PDF uses persisted values (not recomputed)
- ✅ Backend bcrypt → passlib/argon2 migration (fixed hashing errors)
- ✅ PHV motor costs exception (contextual note instead of risk indicator)

## User Personas
1. **Self-employed freelancers** - Checking risk before filing
2. **Small business owners** - Understanding HMRC scrutiny patterns
3. **Tax preparers** - Quick risk screening for clients
4. **PHV/Taxi drivers** - High motor costs tracking

## Core Requirements (Static)
- Secure web form for tax data entry
- Instant risk score calculation
- FREE tier: Risk band only
- PAID tier (£29.99): Full PDF report
- Legal disclaimer on all pages
- Admin dashboard for case management
- Industry-specific risk thresholds

## P0/P1/P2 Feature Backlog

### P0 (Critical) - DONE
- [x] Risk calculation engine
- [x] Payment integration
- [x] PDF generation
- [x] Admin dashboard
- [x] Preview mode for ResultsPage (with all 5 security criteria)
- [x] PHV/mileage tooltip rule (audit-safe wording)

### P1 (Complete)
- [x] UI/UX Polish for V2 ResultsPage:
  - [x] Visual hierarchy: Score hero + top 3 drivers above the fold
  - [x] Simulation tool: Input fields + sliders, "No changes saved" microcopy, Reset button
  - [x] Risk indicators: "Risk Signal" vs "Context Note" chips, weight badges
  - [x] Benchmark comparison: Banded sector range bars with disclaimer
  - [x] Paywall: 3-bullet value stack

### P1 (In Progress)
- [ ] V2 User Accounts (magic link login flow + dashboard)
- [ ] V2 Admin Dashboard (industry filters, conversion stats)
- [ ] Compare to Industry Average (banded benchmarking with disclaimers)

### P2 (Future)
- [ ] V2 Pricing Update (£29.99–£39.99 configurable)
- [ ] Brevo email integration (requires API key from user)
- [ ] S3 storage configuration (requires AWS credentials)
- [ ] Multiple tax year comparison
- [ ] White-label options

## API Endpoints
- POST /api/assessment/submit - Submit tax assessment
- GET /api/assessment/{assessment_id} - Get assessment details
- POST /api/assessment/simulate - Run what-if simulation
- POST /api/checkout/create - Create Stripe checkout
- GET /api/checkout/status/{session_id} - Check payment status
- GET /api/report/download/{assessment_id} - Download PDF
- GET /api/industries - Get industry list
- GET /api/pricing - Get pricing info
- POST /api/auth/magic-link - Request magic link login
- POST /api/auth/verify - Verify magic link token
- GET /api/user/assessments - Get user's past assessments
- POST /api/admin/register - Register admin
- POST /api/admin/login - Admin login
- GET /api/admin/assessments - List all assessments
- GET /api/admin/stats - Dashboard stats
- GET /api/admin/transactions - List transactions

## Next Tasks
1. UI/UX Polish for V2 ResultsPage (visual hierarchy improvements)
2. Implement V2 user accounts (magic link flow)
3. Enhance admin dashboard with industry filters
4. Configure Brevo API key for email delivery
5. Test full payment flow with Stripe test cards
