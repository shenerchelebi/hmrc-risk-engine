import requests
import sys
import json
from datetime import datetime

class HMRCAPITester:
    def __init__(self, base_url="https://taxscan-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")

    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}, Response: {response.json() if success else response.text}"
            self.log_test("API Root Endpoint", success, details)
            return success
        except Exception as e:
            self.log_test("API Root Endpoint", False, f"Error: {str(e)}")
            return False

    def test_assessment_submission(self):
        """Test assessment submission with valid data"""
        test_data = {
            "tax_year": "2023-24",
            "turnover": 50000.0,
            "total_expenses": 30000.0,
            "motor_costs": 5000.0,
            "mileage_claimed": 3000.0,
            "method": "actual",
            "home_office_amount": 3000.0,
            "phone_internet": 600.0,
            "travel_subsistence": 5000.0,
            "marketing": 2000.0,
            "loss_this_year": False,
            "loss_last_year": False,
            "other_income": False,
            "email": "test@example.com"
        }
        
        try:
            response = requests.post(f"{self.api_url}/assessment/submit", json=test_data, timeout=15)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                assessment_id = data.get('assessment_id')
                risk_score = data.get('risk_score')
                risk_band = data.get('risk_band')
                has_inconsistency = data.get('has_data_inconsistency', False)
                
                details = f"Assessment ID: {assessment_id}, Risk Score: {risk_score}, Risk Band: {risk_band}, Data Inconsistency: {has_inconsistency}"
                
                # Store assessment ID for later tests
                self.assessment_id = assessment_id
            else:
                details = f"Status: {response.status_code}, Error: {response.text}"
                
            self.log_test("Assessment Submission (Valid Data)", success, details)
            return success, assessment_id if success else None
        except Exception as e:
            self.log_test("Assessment Submission (Valid Data)", False, f"Error: {str(e)}")
            return False, None

    def test_data_inconsistency_validation(self):
        """Test data inconsistency validation (loss checkbox true but profit positive)"""
        test_data = {
            "tax_year": "2023-24",
            "turnover": 50000.0,
            "total_expenses": 30000.0,  # This creates a profit of 20,000
            "motor_costs": 5000.0,
            "mileage_claimed": 3000.0,
            "method": "actual",
            "home_office_amount": 3000.0,
            "phone_internet": 600.0,
            "travel_subsistence": 5000.0,
            "marketing": 2000.0,
            "loss_this_year": True,  # This should trigger inconsistency
            "loss_last_year": False,
            "other_income": False,
            "email": "test-inconsistency@example.com"
        }
        
        try:
            response = requests.post(f"{self.api_url}/assessment/submit", json=test_data, timeout=15)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                has_inconsistency = data.get('has_data_inconsistency', False)
                risk_score = data.get('risk_score')
                
                # Should detect inconsistency
                inconsistency_detected = has_inconsistency == True
                details = f"Data Inconsistency Detected: {has_inconsistency}, Risk Score: {risk_score}"
                
                self.log_test("Data Inconsistency Detection", inconsistency_detected, details)
                return inconsistency_detected
            else:
                details = f"Status: {response.status_code}, Error: {response.text}"
                self.log_test("Data Inconsistency Detection", False, details)
                return False
        except Exception as e:
            self.log_test("Data Inconsistency Detection", False, f"Error: {str(e)}")
            return False

    def test_get_assessment(self, assessment_id):
        """Test retrieving assessment by ID"""
        if not assessment_id:
            self.log_test("Get Assessment by ID", False, "No assessment ID available")
            return False
            
        try:
            response = requests.get(f"{self.api_url}/assessment/{assessment_id}", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Retrieved assessment: ID={data.get('id')}, Risk Score={data.get('risk_score')}, Risk Band={data.get('risk_band')}"
            else:
                details = f"Status: {response.status_code}, Error: {response.text}"
                
            self.log_test("Get Assessment by ID", success, details)
            return success
        except Exception as e:
            self.log_test("Get Assessment by ID", False, f"Error: {str(e)}")
            return False

    def test_checkout_creation(self, assessment_id):
        """Test checkout session creation"""
        if not assessment_id:
            self.log_test("Checkout Session Creation", False, "No assessment ID available")
            return False
            
        try:
            checkout_data = {
                "assessment_id": assessment_id,
                "origin_url": self.base_url
            }
            
            response = requests.post(f"{self.api_url}/checkout/create", json=checkout_data, timeout=15)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                checkout_url = data.get('checkout_url')
                session_id = data.get('session_id')
                details = f"Checkout URL created, Session ID: {session_id[:20]}..."
            else:
                details = f"Status: {response.status_code}, Error: {response.text}"
                
            self.log_test("Checkout Session Creation", success, details)
            return success
        except Exception as e:
            self.log_test("Checkout Session Creation", False, f"Error: {str(e)}")
            return False

    def test_admin_registration(self):
        """Test admin user registration"""
        admin_data = {
            "username": f"testadmin_{datetime.now().strftime('%H%M%S')}",
            "email": "testadmin@example.com",
            "password": "TestPassword123!",
            "admin_secret": "hmrc-admin-secret-2024"
        }
        
        try:
            response = requests.post(f"{self.api_url}/admin/register", json=admin_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Admin registered: {data.get('message')}"
                # Store credentials for login test
                self.admin_username = admin_data['username']
                self.admin_password = admin_data['password']
            else:
                details = f"Status: {response.status_code}, Error: {response.text}"
                
            self.log_test("Admin Registration", success, details)
            return success
        except Exception as e:
            self.log_test("Admin Registration", False, f"Error: {str(e)}")
            return False

    def test_admin_login(self):
        """Test admin login"""
        if not hasattr(self, 'admin_username'):
            self.log_test("Admin Login", False, "No admin credentials available")
            return False
            
        login_data = {
            "username": self.admin_username,
            "password": self.admin_password
        }
        
        try:
            response = requests.post(f"{self.api_url}/admin/login", json=login_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                self.token = data.get('access_token')
                details = f"Login successful, token received"
            else:
                details = f"Status: {response.status_code}, Error: {response.text}"
                
            self.log_test("Admin Login", success, details)
            return success
        except Exception as e:
            self.log_test("Admin Login", False, f"Error: {str(e)}")
            return False

    def test_admin_stats(self):
        """Test admin stats endpoint"""
        if not self.token:
            self.log_test("Admin Stats", False, "No admin token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.token}"}
        
        try:
            response = requests.get(f"{self.api_url}/admin/stats", headers=headers, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                total_assessments = data.get('total_assessments', 0)
                paid_assessments = data.get('paid_assessments', 0)
                details = f"Total Assessments: {total_assessments}, Paid: {paid_assessments}"
            else:
                details = f"Status: {response.status_code}, Error: {response.text}"
                
            self.log_test("Admin Stats", success, details)
            return success
        except Exception as e:
            self.log_test("Admin Stats", False, f"Error: {str(e)}")
            return False

    def test_profit_calculation_edge_cases(self):
        """Test profit calculation edge cases"""
        # Test case 1: Exact zero profit
        test_data_zero = {
            "tax_year": "2023-24",
            "turnover": 50000.0,
            "total_expenses": 50000.0,  # Exactly equal = 0 profit
            "motor_costs": 0.0,
            "mileage_claimed": 0.0,
            "method": "actual",
            "home_office_amount": 0.0,
            "phone_internet": 0.0,
            "travel_subsistence": 0.0,
            "marketing": 0.0,
            "loss_this_year": False,
            "loss_last_year": False,
            "other_income": False,
            "email": "test-zero@example.com"
        }
        
        try:
            response = requests.post(f"{self.api_url}/assessment/submit", json=test_data_zero, timeout=15)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                risk_score = data.get('risk_score')
                details = f"Zero profit case - Risk Score: {risk_score}"
            else:
                details = f"Status: {response.status_code}, Error: {response.text}"
                
            self.log_test("Profit Calculation (Zero Profit)", success, details)
            return success
        except Exception as e:
            self.log_test("Profit Calculation (Zero Profit)", False, f"Error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting HMRC Red-Flag Detector API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Basic API tests
        self.test_api_root()
        
        # Assessment tests
        success, assessment_id = self.test_assessment_submission()
        self.test_data_inconsistency_validation()
        self.test_profit_calculation_edge_cases()
        
        if assessment_id:
            self.test_get_assessment(assessment_id)
            self.test_checkout_creation(assessment_id)
        
        # Admin tests
        if self.test_admin_registration():
            if self.test_admin_login():
                self.test_admin_stats()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check details above.")
            return 1

def main():
    tester = HMRCAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())