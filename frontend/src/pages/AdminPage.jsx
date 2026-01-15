import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, ArrowLeft, Lock, Users, FileText, PoundSterling, TrendingUp, Download, Loader2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminPage = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [token, setToken] = useState("");
  
  const [stats, setStats] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already logged in
    const savedToken = sessionStorage.getItem('admin_token');
    if (savedToken) {
      setToken(savedToken);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchData();
    }
  }, [isAuthenticated, token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    
    try {
      const response = await axios.post(`${API}/admin/login`, { password });
      if (response.data.success) {
        setToken(response.data.token);
        sessionStorage.setItem('admin_token', response.data.token);
        setIsAuthenticated(true);
        toast.success("Login successful");
      }
    } catch (error) {
      toast.error("Invalid password");
    } finally {
      setLoginLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { 'admin-token': token };
      
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
        setIsAuthenticated(false);
        sessionStorage.removeItem('admin_token');
        toast.error("Session expired");
      } else {
        toast.error("Failed to load data");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    setToken("");
  };

  const getRiskBadge = (band) => {
    const styles = {
      LOW: "bg-emerald-100 text-emerald-800",
      MODERATE: "bg-amber-100 text-amber-800",
      HIGH: "bg-rose-100 text-rose-800"
    };
    return <Badge className={styles[band] || "bg-stone-100 text-stone-800"}>{band}</Badge>;
  };

  const getPaymentBadge = (status) => {
    const styles = {
      paid: "bg-emerald-100 text-emerald-800",
      pending: "bg-amber-100 text-amber-800",
      initiated: "bg-blue-100 text-blue-800",
      failed: "bg-rose-100 text-rose-800"
    };
    return <Badge className={styles[status] || "bg-stone-100 text-stone-800"}>{status}</Badge>;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-50 paper-texture flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-stone-200 px-6 md:px-12 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-teal-600" />
              <span className="font-serif font-semibold text-slate-900">Admin Dashboard</span>
            </div>
          </div>
        </header>

        {/* Login Form */}
        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="card-elevated w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="font-serif text-2xl">Admin Login</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Input
                    type="password"
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12"
                    data-testid="admin-password-input"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-slate-900 hover:bg-slate-800"
                  disabled={loginLoading}
                  data-testid="admin-login-btn"
                >
                  {loginLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Login"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 md:px-12 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-teal-400" />
            <span className="font-serif font-semibold">HMRC Red-Flag Detector</span>
            <Badge className="bg-teal-600 text-white ml-2">Admin</Badge>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              className="text-stone-300 hover:text-white hover:bg-white/10"
              onClick={fetchData}
              data-testid="refresh-btn"
            >
              Refresh
            </Button>
            <Button 
              variant="outline" 
              className="border-stone-600 text-stone-300 hover:bg-white/10"
              onClick={handleLogout}
              data-testid="logout-btn"
            >
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
              <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid md:grid-cols-4 gap-6 mb-8">
                <Card className="card-elevated">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Users className="h-6 w-6 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm text-stone-600">Total Assessments</p>
                        <p className="text-2xl font-bold text-slate-900" data-testid="stat-total">
                          {stats?.total_assessments || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-elevated">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <FileText className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm text-stone-600">Reports Sold</p>
                        <p className="text-2xl font-bold text-slate-900" data-testid="stat-paid">
                          {stats?.paid_assessments || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-elevated">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-sm text-stone-600">Conversion Rate</p>
                        <p className="text-2xl font-bold text-slate-900" data-testid="stat-conversion">
                          {stats?.conversion_rate || 0}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-elevated">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                        <PoundSterling className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-stone-600">Total Revenue</p>
                        <p className="text-2xl font-bold text-slate-900" data-testid="stat-revenue">
                          £{stats?.total_revenue?.toLocaleString() || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Risk Breakdown */}
              <Card className="card-elevated mb-8">
                <CardHeader>
                  <CardTitle className="font-serif">Risk Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-8">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                      <span className="text-stone-600">Low Risk:</span>
                      <span className="font-semibold">{stats?.risk_breakdown?.low || 0}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-amber-500 rounded"></div>
                      <span className="text-stone-600">Moderate Risk:</span>
                      <span className="font-semibold">{stats?.risk_breakdown?.moderate || 0}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-rose-500 rounded"></div>
                      <span className="text-stone-600">High Risk:</span>
                      <span className="font-semibold">{stats?.risk_breakdown?.high || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <Tabs defaultValue="assessments" className="space-y-6">
                <TabsList className="bg-white border border-stone-200">
                  <TabsTrigger value="assessments" data-testid="tab-assessments">
                    Assessments ({assessments.length})
                  </TabsTrigger>
                  <TabsTrigger value="transactions" data-testid="tab-transactions">
                    Transactions ({transactions.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="assessments">
                  <Card className="card-elevated">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-900 hover:bg-slate-900">
                              <TableHead className="text-white">Date</TableHead>
                              <TableHead className="text-white">Email</TableHead>
                              <TableHead className="text-white">Tax Year</TableHead>
                              <TableHead className="text-white">Turnover</TableHead>
                              <TableHead className="text-white">Score</TableHead>
                              <TableHead className="text-white">Risk</TableHead>
                              <TableHead className="text-white">Status</TableHead>
                              <TableHead className="text-white">PDF</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {assessments.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-stone-500">
                                  No assessments yet
                                </TableCell>
                              </TableRow>
                            ) : (
                              assessments.map((a) => (
                                <TableRow key={a.id} className="hover:bg-stone-50">
                                  <TableCell className="text-sm">
                                    {new Date(a.created_at).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell className="text-sm font-mono">{a.email}</TableCell>
                                  <TableCell>{a.tax_year}</TableCell>
                                  <TableCell>£{a.turnover?.toLocaleString()}</TableCell>
                                  <TableCell className="font-semibold">{a.risk_score}</TableCell>
                                  <TableCell>{getRiskBadge(a.risk_band)}</TableCell>
                                  <TableCell>{getPaymentBadge(a.payment_status)}</TableCell>
                                  <TableCell>
                                    {a.pdf_path && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
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
                  <Card className="card-elevated">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-900 hover:bg-slate-900">
                              <TableHead className="text-white">Date</TableHead>
                              <TableHead className="text-white">Email</TableHead>
                              <TableHead className="text-white">Amount</TableHead>
                              <TableHead className="text-white">Session ID</TableHead>
                              <TableHead className="text-white">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transactions.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-stone-500">
                                  No transactions yet
                                </TableCell>
                              </TableRow>
                            ) : (
                              transactions.map((t) => (
                                <TableRow key={t.id} className="hover:bg-stone-50">
                                  <TableCell className="text-sm">
                                    {new Date(t.created_at).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell className="text-sm font-mono">{t.email}</TableCell>
                                  <TableCell>£{t.amount}</TableCell>
                                  <TableCell className="text-xs font-mono text-stone-500">
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
