"""
Admin Dashboard API Tests
Tests for admin authentication, stats, assessments, and transactions endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from requirements
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"
ADMIN_SECRET = "hmrc-admin-secret-2024"


class TestAdminAuthentication:
    """Admin login and registration tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials returns access_token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "token_type" in data, "Response should contain token_type"
        assert data["token_type"] == "bearer", "Token type should be bearer"
        assert "expires_in" in data, "Response should contain expires_in"
        assert len(data["access_token"]) > 0, "Access token should not be empty"
        print(f"✓ Admin login successful, token length: {len(data['access_token'])}")
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "wronguser",
            "password": "wrongpass"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Response should contain error detail"
        print(f"✓ Invalid credentials correctly rejected with 401")
    
    def test_admin_register_wrong_secret(self):
        """Test admin registration with wrong secret key returns 403"""
        response = requests.post(f"{BASE_URL}/api/admin/register", json={
            "username": "newadmin",
            "email": "newadmin@test.com",
            "password": "testpass123",
            "admin_secret": "wrong-secret-key"
        })
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Response should contain error detail"
        assert "Invalid admin secret" in data["detail"], "Error should mention invalid secret"
        print(f"✓ Wrong admin secret correctly rejected with 403")
    
    def test_admin_register_correct_secret(self):
        """Test admin registration with correct secret key"""
        import uuid
        unique_username = f"testadmin_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/admin/register", json={
            "username": unique_username,
            "email": f"{unique_username}@test.com",
            "password": "testpass123",
            "admin_secret": ADMIN_SECRET
        })
        # Either 200 (success) or 400 (username exists) is acceptable
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Registration should return success=True"
            print(f"✓ Admin registration successful for {unique_username}")
        else:
            print(f"✓ Admin registration returned 400 (username may exist)")


class TestAdminEndpointsAuth:
    """Test that admin endpoints require authentication"""
    
    def test_admin_stats_requires_auth(self):
        """Test GET /api/admin/stats returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ /api/admin/stats correctly requires authentication")
    
    def test_admin_assessments_requires_auth(self):
        """Test GET /api/admin/assessments returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/admin/assessments")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ /api/admin/assessments correctly requires authentication")
    
    def test_admin_transactions_requires_auth(self):
        """Test GET /api/admin/transactions returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/admin/transactions")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ /api/admin/transactions correctly requires authentication")
    
    def test_admin_me_requires_auth(self):
        """Test GET /api/admin/me returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/admin/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ /api/admin/me correctly requires authentication")


class TestAdminStats:
    """Test admin stats endpoint with authentication"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_admin_stats_returns_metrics(self, admin_token):
        """Test GET /api/admin/stats returns all required metrics"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check required fields
        assert "total_assessments" in data, "Should have total_assessments"
        assert "paid_assessments" in data, "Should have paid_assessments"
        assert "conversion_rate" in data, "Should have conversion_rate"
        assert "total_revenue" in data, "Should have total_revenue"
        assert "risk_breakdown" in data, "Should have risk_breakdown"
        assert "industry_breakdown" in data, "Should have industry_breakdown"
        
        # Validate risk breakdown structure
        risk = data["risk_breakdown"]
        assert "low" in risk, "Risk breakdown should have 'low'"
        assert "moderate" in risk, "Risk breakdown should have 'moderate'"
        assert "high" in risk, "Risk breakdown should have 'high'"
        
        # Validate industry breakdown structure
        industry = data["industry_breakdown"]
        assert isinstance(industry, dict), "Industry breakdown should be a dict"
        
        # Validate data types
        assert isinstance(data["total_assessments"], int), "total_assessments should be int"
        assert isinstance(data["paid_assessments"], int), "paid_assessments should be int"
        assert isinstance(data["conversion_rate"], (int, float)), "conversion_rate should be numeric"
        assert isinstance(data["total_revenue"], (int, float)), "total_revenue should be numeric"
        
        print(f"✓ Admin stats returned: total={data['total_assessments']}, paid={data['paid_assessments']}, conversion={data['conversion_rate']}%, revenue=£{data['total_revenue']}")
        print(f"  Risk breakdown: low={risk['low']}, moderate={risk['moderate']}, high={risk['high']}")
    
    def test_admin_stats_with_invalid_token(self):
        """Test GET /api/admin/stats with invalid token returns 401"""
        headers = {"Authorization": "Bearer invalid_token_here"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid token correctly rejected")


class TestAdminAssessments:
    """Test admin assessments endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_admin_assessments_returns_list(self, admin_token):
        """Test GET /api/admin/assessments returns assessments list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/assessments", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "assessments" in data, "Response should have 'assessments' key"
        assert "total" in data, "Response should have 'total' key"
        assert isinstance(data["assessments"], list), "Assessments should be a list"
        
        # If there are assessments, validate structure
        if len(data["assessments"]) > 0:
            assessment = data["assessments"][0]
            # Check expected fields
            expected_fields = ["id", "email", "tax_year", "turnover", "risk_score", "risk_band", "payment_status"]
            for field in expected_fields:
                assert field in assessment, f"Assessment should have '{field}' field"
            
            print(f"✓ Admin assessments returned {data['total']} assessments")
            print(f"  Sample: email={assessment['email']}, risk_band={assessment['risk_band']}, status={assessment['payment_status']}")
        else:
            print(f"✓ Admin assessments endpoint working (0 assessments)")
    
    def test_admin_assessments_with_industry_filter(self, admin_token):
        """Test GET /api/admin/assessments with industry filter"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/assessments?industry=phv_taxi", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "assessments" in data, "Response should have 'assessments' key"
        
        # All returned assessments should be phv_taxi industry
        for assessment in data["assessments"]:
            if "industry" in assessment:
                assert assessment["industry"] == "phv_taxi", f"Filtered assessment should be phv_taxi, got {assessment.get('industry')}"
        
        print(f"✓ Industry filter working, returned {len(data['assessments'])} phv_taxi assessments")


class TestAdminTransactions:
    """Test admin transactions endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_admin_transactions_returns_list(self, admin_token):
        """Test GET /api/admin/transactions returns transactions list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/transactions", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "transactions" in data, "Response should have 'transactions' key"
        assert "total" in data, "Response should have 'total' key"
        assert isinstance(data["transactions"], list), "Transactions should be a list"
        
        # If there are transactions, validate structure
        if len(data["transactions"]) > 0:
            transaction = data["transactions"][0]
            expected_fields = ["id", "assessment_id", "email", "amount", "payment_status"]
            for field in expected_fields:
                assert field in transaction, f"Transaction should have '{field}' field"
            
            print(f"✓ Admin transactions returned {data['total']} transactions")
            print(f"  Sample: email={transaction['email']}, amount=£{transaction['amount']}, status={transaction['payment_status']}")
        else:
            print(f"✓ Admin transactions endpoint working (0 transactions)")


class TestAdminMe:
    """Test admin profile endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_admin_me_returns_profile(self, admin_token):
        """Test GET /api/admin/me returns admin profile"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/me", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "id" in data, "Response should have 'id'"
        assert "username" in data, "Response should have 'username'"
        assert "email" in data, "Response should have 'email'"
        assert data["username"] == ADMIN_USERNAME, f"Username should be {ADMIN_USERNAME}"
        
        print(f"✓ Admin profile: username={data['username']}, email={data['email']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
