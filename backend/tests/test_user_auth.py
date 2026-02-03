"""
Backend tests for User Accounts feature - Magic Link Authentication
Tests: Magic link login flow, user dashboard, assessment linking, PDF access control
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://taxscan-4.preview.emergentagent.com').rstrip('/')

class TestMagicLinkAuth:
    """Magic link authentication flow tests"""
    
    def test_request_magic_link_success(self):
        """POST /api/auth/magic-link - Request magic link for valid email"""
        response = requests.post(f"{BASE_URL}/api/auth/magic-link", json={
            "email": "test_auth@example.com"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "message" in data
        # In demo mode (Brevo not configured), token is returned directly
        assert "token" in data
        assert data["token"] is not None
        print(f"Magic link token received: {data['token'][:20]}...")
    
    def test_request_magic_link_invalid_email(self):
        """POST /api/auth/magic-link - Invalid email format should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/magic-link", json={
            "email": "invalid-email"
        })
        assert response.status_code == 422  # Validation error
    
    def test_verify_magic_link_success(self):
        """POST /api/auth/verify - Verify valid magic link token"""
        # First request a magic link
        magic_response = requests.post(f"{BASE_URL}/api/auth/magic-link", json={
            "email": "test_verify@example.com"
        })
        assert magic_response.status_code == 200
        token = magic_response.json()["token"]
        
        # Verify the token
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify", json={
            "token": token
        })
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0
        print(f"Access token received, expires in {data['expires_in']} seconds")
    
    def test_verify_magic_link_invalid_token(self):
        """POST /api/auth/verify - Invalid token should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/verify", json={
            "token": "invalid-token-12345"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    def test_verify_magic_link_reuse_blocked(self):
        """POST /api/auth/verify - Token should be single-use"""
        # Request a magic link
        magic_response = requests.post(f"{BASE_URL}/api/auth/magic-link", json={
            "email": "test_reuse@example.com"
        })
        token = magic_response.json()["token"]
        
        # First verification should succeed
        verify1 = requests.post(f"{BASE_URL}/api/auth/verify", json={"token": token})
        assert verify1.status_code == 200
        
        # Second verification should fail (token cleared)
        verify2 = requests.post(f"{BASE_URL}/api/auth/verify", json={"token": token})
        assert verify2.status_code == 401


class TestUserAssessments:
    """User assessments endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for test user"""
        magic_response = requests.post(f"{BASE_URL}/api/auth/magic-link", json={
            "email": "test_assessments@example.com"
        })
        token = magic_response.json()["token"]
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify", json={"token": token})
        return verify_response.json()["access_token"]
    
    def test_get_assessments_requires_auth(self):
        """GET /api/user/assessments - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/user/assessments")
        assert response.status_code == 401
        data = response.json()
        assert data["detail"] == "Login required"
    
    def test_get_assessments_with_auth(self, auth_token):
        """GET /api/user/assessments - Should return assessments for authenticated user"""
        response = requests.get(
            f"{BASE_URL}/api/user/assessments",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "assessments" in data
        assert isinstance(data["assessments"], list)
    
    def test_create_assessment_with_auth_links_to_user(self, auth_token):
        """POST /api/assessment/submit - Assessment with auth should link to user"""
        # Create assessment with auth token
        assessment_data = {
            "tax_year": "2023-24",
            "industry": "consultant_it",
            "turnover": 80000,
            "total_expenses": 20000,
            "motor_costs": 2000,
            "mileage_claimed": 0,
            "method": "actual",
            "home_office_amount": 1000,
            "phone_internet": 500,
            "travel_subsistence": 500,
            "marketing": 200,
            "loss_this_year": False,
            "loss_last_year": False,
            "email": "test_assessments@example.com",
            "report_type": "v2_pro"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/assessment/submit",
            json=assessment_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200
        created = create_response.json()
        assert created["success"] == True
        assessment_id = created["assessment_id"]
        
        # Verify assessment appears in user's list
        list_response = requests.get(
            f"{BASE_URL}/api/user/assessments",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert list_response.status_code == 200
        assessments = list_response.json()["assessments"]
        
        # Find the created assessment
        found = any(a["id"] == assessment_id for a in assessments)
        assert found, f"Assessment {assessment_id} not found in user's assessments"
        print(f"Assessment {assessment_id} successfully linked to user")


class TestPDFAccessControl:
    """PDF download access control tests"""
    
    def test_pdf_download_blocked_for_unpaid(self):
        """GET /api/report/download/{id} - Should return 403 for unpaid assessment"""
        # First create an unpaid assessment
        assessment_data = {
            "tax_year": "2023-24",
            "industry": "retail",
            "turnover": 50000,
            "total_expenses": 30000,
            "motor_costs": 1000,
            "mileage_claimed": 0,
            "method": "actual",
            "home_office_amount": 500,
            "phone_internet": 200,
            "travel_subsistence": 300,
            "marketing": 100,
            "loss_this_year": False,
            "loss_last_year": False,
            "email": "test_pdf@example.com",
            "report_type": "v2_pro"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/assessment/submit", json=assessment_data)
        assert create_response.status_code == 200
        assessment_id = create_response.json()["assessment_id"]
        
        # Try to download PDF (should be blocked)
        download_response = requests.get(f"{BASE_URL}/api/report/download/{assessment_id}")
        assert download_response.status_code == 403
        data = download_response.json()
        assert data["detail"] == "Report not purchased"
    
    def test_pdf_download_not_found(self):
        """GET /api/report/download/{id} - Should return 404 for non-existent assessment"""
        response = requests.get(f"{BASE_URL}/api/report/download/non-existent-id-12345")
        assert response.status_code == 404
        data = response.json()
        assert data["detail"] == "Assessment not found"


class TestStatusBadges:
    """Status badge verification tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        magic_response = requests.post(f"{BASE_URL}/api/auth/magic-link", json={
            "email": "test_badges@example.com"
        })
        token = magic_response.json()["token"]
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify", json={"token": token})
        return verify_response.json()["access_token"]
    
    def test_unpaid_assessment_has_pending_status(self, auth_token):
        """Unpaid assessment should have payment_status='pending' (Preview badge)"""
        # Create assessment
        assessment_data = {
            "tax_year": "2023-24",
            "industry": "cleaning",
            "turnover": 35000,
            "total_expenses": 15000,
            "motor_costs": 3000,
            "mileage_claimed": 5000,
            "method": "mileage",
            "home_office_amount": 300,
            "phone_internet": 200,
            "travel_subsistence": 400,
            "marketing": 50,
            "loss_this_year": False,
            "loss_last_year": False,
            "email": "test_badges@example.com",
            "report_type": "v2_pro"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/assessment/submit",
            json=assessment_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200
        assessment_id = create_response.json()["assessment_id"]
        
        # Get assessment details
        get_response = requests.get(f"{BASE_URL}/api/assessment/{assessment_id}")
        assert get_response.status_code == 200
        assessment = get_response.json()
        
        # Verify payment status is pending (Preview badge)
        assert assessment["payment_status"] == "pending"
        print(f"Assessment {assessment_id} has payment_status='pending' (Preview badge)")
    
    def test_assessment_list_includes_payment_status(self, auth_token):
        """User assessments list should include payment_status for badge display"""
        response = requests.get(
            f"{BASE_URL}/api/user/assessments",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assessments = response.json()["assessments"]
        
        if assessments:
            # Verify each assessment has payment_status field
            for assessment in assessments:
                assert "payment_status" in assessment
                assert assessment["payment_status"] in ["pending", "paid"]
                print(f"Assessment {assessment['id']}: payment_status={assessment['payment_status']}")


class TestAssessmentRetrieval:
    """Assessment retrieval tests"""
    
    def test_get_assessment_by_id(self):
        """GET /api/assessment/{id} - Should return full assessment details"""
        # Create assessment first
        assessment_data = {
            "tax_year": "2023-24",
            "industry": "construction_cis",
            "turnover": 60000,
            "total_expenses": 35000,
            "motor_costs": 5000,
            "mileage_claimed": 0,
            "method": "actual",
            "home_office_amount": 200,
            "phone_internet": 300,
            "travel_subsistence": 1000,
            "marketing": 100,
            "loss_this_year": False,
            "loss_last_year": False,
            "email": "test_retrieval@example.com",
            "report_type": "v2_pro"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/assessment/submit", json=assessment_data)
        assert create_response.status_code == 200
        assessment_id = create_response.json()["assessment_id"]
        
        # Get assessment
        get_response = requests.get(f"{BASE_URL}/api/assessment/{assessment_id}")
        assert get_response.status_code == 200
        assessment = get_response.json()
        
        # Verify all expected fields
        assert assessment["id"] == assessment_id
        assert assessment["tax_year"] == "2023-24"
        assert assessment["industry"] == "construction_cis"
        assert assessment["industry_name"] == "Construction / CIS"
        assert assessment["turnover"] == 60000
        assert assessment["total_expenses"] == 35000
        assert "risk_score" in assessment
        assert "risk_band" in assessment
        assert "payment_status" in assessment
        print(f"Assessment retrieved: risk_score={assessment['risk_score']}, risk_band={assessment['risk_band']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
