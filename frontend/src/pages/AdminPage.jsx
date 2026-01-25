import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Shield, ArrowLeft, Lock, Users, FileText, PoundSterling, TrendingUp, Download, Loader2, LogOut, UserPlus } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminPage = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState({ username: "", email: "", password: "", admin_secret: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [token, setToken] = useState("");
  const [adminInfo, setAdminInfo] = useState(null);
  
  const [stats, setStats] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      setToken(savedToken);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchData();
      fetchAdminInfo();
    }
  }, [isAuthenticated, token]);

  const fetchAdminInfo = async () => {
    try {
      const response = await axios.get(`${API}/admin/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdminInfo(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    
    try {
      const response = await axios.post(`${API}/admin/login`, loginData);
      if (response.data.access_token) {
        setToken(response.data.access_token);
        localStorage.setItem('admin_token', response.data.access_token);
        setIsAuthenticated(true);
        toast.success("Login successful");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid credentials");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    
    try {
      await axios.post(`${API}/admin/register`, registerData);
      toast.success("Admin account created! You can now login.");
      setShowRegister(false);
      setLoginData({ username: registerData.username, password: registerData.password });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoginLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statsRes, assessmentsRes, transactionsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers }),
        axios.get(`${API}/admin/assessments`, { headers }),
        axios.get(`${API}/admin/transactions`, { headers })
      ]);
      
      setStats(statsRes.data);
      setAssessments(assessmentsRes.data.assessments);
      setTransactions(transactionsRes.data.transactions);
    } catch (error) {
      console.error("Fetch error:", error);
      if (error.response?.status === 401) {
        handleLogout();
        toast.error("Session expired");
      } else {
        toast.error("Failed to load data");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    setToken("");
    setAdminInfo(null);
  };

  const getRiskBadge = (band) => {
    const styles = {
      LOW: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
      MODERATE: "bg-amber-500/20 text-amber-400 border-amber-500/50",
      HIGH: "bg-rose-500/20 text-rose-400 border-rose-500/50"
    };
    return <Badge className={`${styles[band] || "bg-zinc-500/20 text-zinc-400"} border`}>{band}</Badge>;
  };

  const getPaymentBadge = (status) => {
    const styles = {
      paid: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
      pending: "bg-amber-500/20 text-amber-400 border-amber-500/50",
      initiated: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      failed: "bg-rose-500/20 text-rose-400 border-rose-500/50"
    };
    return <Badge className={`${styles[status] || "bg-zinc-500/20 text-zinc-400"} border`}>{status}</Badge>;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
        {/* Header */}
        <header className="bg-[#0d0d14] border-b border-zinc-800 px-6 md:px-12 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-500" />
              <span className="font-serif font-semibold text-white">Admin Portal</span>
            </div>
          </div>
        </header>

        {/* Login/Register Form */}
        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="card-dark border-zinc-800 w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-teal-500/20 border border-teal-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="h-8 w-8 text-teal-400" />
              </div>
              <CardTitle className="font-serif text-2xl text-white">
                {showRegister ? "Create Admin Account" : "Admin Login"}
              </CardTitle>
              <CardDescription className="text-zinc-500">
                {showRegister ? "Register a new administrator" : "Sign in to access the dashboard"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showRegister ? (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Username</Label>
                    <Input
                      type="text"
                      placeholder="admin"
                      value={registerData.username}
                      onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                      className="h-12 bg-zinc-900 border-zinc-700 text-white"
                      data-testid="register-username-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Email</Label>
                    <Input
                      type="email"
                      placeholder="admin@company.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      className="h-12 bg-zinc-900 border-zinc-700 text-white"
                      data-testid="register-email-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      className="h-12 bg-zinc-900 border-zinc-700 text-white"
                      data-testid="register-password-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Admin Secret Key</Label>
                    <Input
                      type="password"
                      placeholder="Secret key"
                      value={registerData.admin_secret}
                      onChange={(e) => setRegisterData({ ...registerData, admin_secret: e.target.value })}
                      className="h-12 bg-zinc-900 border-zinc-700 text-white"
                      data-testid="register-secret-input"
                    />
                    <p className="text-xs text-zinc-600">Contact your system administrator for the secret key</p>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-teal-600 hover:bg-teal-500"
                    disabled={loginLoading}
                    data-testid="register-submit-btn"
                  >
                    {loginLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Account"}
                  </Button>
                  <Button 
                    type="button"
                    variant="ghost"
                    className="w-full text-zinc-500 hover:text-white"
                    onClick={() => setShowRegister(false)}
                  >
                    Already have an account? Login
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Username</Label>
                    <Input
                      type="text"
                      placeholder="admin"
                      value={loginData.username}
                      onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                      className="h-12 bg-zinc-900 border-zinc-700 text-white"
                      data-testid="admin-username-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="h-12 bg-zinc-900 border-zinc-700 text-white"
                      data-testid="admin-password-input"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-teal-600 hover:bg-teal-500"
                    disabled={loginLoading}
                    data-testid="admin-login-btn"
                  >
                    {loginLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Login"}
                  </Button>
                  <Button 
                    type="button"
                    variant="ghost"
                    className="w-full text-zinc-500 hover:text-white"
                    onClick={() => setShowRegister(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Admin Account
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="bg-[#0d0d14] border-b border-zinc-800 px-6 md:px-12 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/20 border border-teal-500/30">
              <Shield className="h-5 w-5 text-teal-400" />
            </div>
            <span className="font-serif font-semibold text-white">HMRC Red-Flag Detector</span>
            <Badge className="bg-teal-500/20 text-teal-400 border border-teal-500/30">Admin</Badge>
          </div>
          <div className="flex items-center gap-4">
            {adminInfo && (
              <span className="text-zinc-500 text-sm hidden md:block">
                Logged in as <span className="text-white">{adminInfo.username}</span>
              </span>
            )}
            <Button 
              variant="ghost" 
              className="text-zinc-400 hover:text-white hover:bg-zinc-800"
              onClick={fetchData}
              data-testid="refresh-btn"
            >
              Refresh
            </Button>
            <Button 
              variant="outline" 
              className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              onClick={handleLogout}
              data-testid="logout-btn"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto">
          {loading && !stats ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid md:grid-cols-4 gap-6 mb-8">
                <Card className="card-dark border-zinc-800 stat-card">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center">
                        <Users className="h-6 w-6 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Total Assessments</p>
                        <p className="text-2xl font-bold text-white" data-testid="stat-total">
                          {stats?.total_assessments || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-dark border-zinc-800 stat-card">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                        <FileText className="h-6 w-6 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Reports Sold</p>
                        <p className="text-2xl font-bold text-white" data-testid="stat-paid">
                          {stats?.paid_assessments || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-dark border-zinc-800 stat-card">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-teal-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Conversion Rate</p>
                        <p className="text-2xl font-bold text-white" data-testid="stat-conversion">
                          {stats?.conversion_rate || 0}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-dark border-zinc-800 stat-card">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                        <PoundSterling className="h-6 w-6 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Total Revenue</p>
                        <p className="text-2xl font-bold text-white" data-testid="stat-revenue">
                          £{stats?.total_revenue?.toLocaleString() || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Risk Breakdown */}
              <Card className="card-dark border-zinc-800 mb-8">
                <CardHeader>
                  <CardTitle className="font-serif text-white">Risk Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-8">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                      <span className="text-zinc-500">Low Risk:</span>
                      <span className="font-semibold text-white">{stats?.risk_breakdown?.low || 0}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-amber-500 rounded"></div>
                      <span className="text-zinc-500">Moderate Risk:</span>
                      <span className="font-semibold text-white">{stats?.risk_breakdown?.moderate || 0}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-rose-500 rounded"></div>
                      <span className="text-zinc-500">High Risk:</span>
                      <span className="font-semibold text-white">{stats?.risk_breakdown?.high || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <Tabs defaultValue="assessments" className="space-y-6">
                <TabsList className="bg-zinc-900 border border-zinc-800">
                  <TabsTrigger value="assessments" className="data-[state=active]:bg-zinc-800" data-testid="tab-assessments">
                    Assessments ({assessments.length})
                  </TabsTrigger>
                  <TabsTrigger value="transactions" className="data-[state=active]:bg-zinc-800" data-testid="tab-transactions">
                    Transactions ({transactions.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="assessments">
                  <Card className="card-dark border-zinc-800">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-zinc-800 hover:bg-transparent">
                              <TableHead className="text-zinc-400">Date</TableHead>
                              <TableHead className="text-zinc-400">Email</TableHead>
                              <TableHead className="text-zinc-400">Tax Year</TableHead>
                              <TableHead className="text-zinc-400">Turnover</TableHead>
                              <TableHead className="text-zinc-400">Score</TableHead>
                              <TableHead className="text-zinc-400">Risk</TableHead>
                              <TableHead className="text-zinc-400">Status</TableHead>
                              <TableHead className="text-zinc-400">PDF</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {assessments.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-zinc-600">
                                  No assessments yet
                                </TableCell>
                              </TableRow>
                            ) : (
                              assessments.map((a) => (
                                <TableRow key={a.id} className="border-zinc-800 hover:bg-zinc-800/50">
                                  <TableCell className="text-sm text-zinc-400">
                                    {new Date(a.created_at).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell className="text-sm font-mono text-zinc-300">{a.email}</TableCell>
                                  <TableCell className="text-zinc-300">{a.tax_year}</TableCell>
                                  <TableCell className="text-zinc-300">£{a.turnover?.toLocaleString()}</TableCell>
                                  <TableCell className="font-semibold text-white">{a.risk_score}</TableCell>
                                  <TableCell>{getRiskBadge(a.risk_band)}</TableCell>
                                  <TableCell>{getPaymentBadge(a.payment_status)}</TableCell>
                                  <TableCell>
                                    {a.pdf_path && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-zinc-400 hover:text-white"
                                        onClick={() => window.open(`${API}/report/download/${a.id}`, '_blank')}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="transactions">
                  <Card className="card-dark border-zinc-800">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-zinc-800 hover:bg-transparent">
                              <TableHead className="text-zinc-400">Date</TableHead>
                              <TableHead className="text-zinc-400">Email</TableHead>
                              <TableHead className="text-zinc-400">Amount</TableHead>
                              <TableHead className="text-zinc-400">Session ID</TableHead>
                              <TableHead className="text-zinc-400">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transactions.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-zinc-600">
                                  No transactions yet
                                </TableCell>
                              </TableRow>
                            ) : (
                              transactions.map((t) => (
                                <TableRow key={t.id} className="border-zinc-800 hover:bg-zinc-800/50">
                                  <TableCell className="text-sm text-zinc-400">
                                    {new Date(t.created_at).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell className="text-sm font-mono text-zinc-300">{t.email}</TableCell>
                                  <TableCell className="text-zinc-300">£{t.amount}</TableCell>
                                  <TableCell className="text-xs font-mono text-zinc-600">
                                    {t.session_id?.substring(0, 20)}...
                                  </TableCell>
                                  <TableCell>{getPaymentBadge(t.payment_status)}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
