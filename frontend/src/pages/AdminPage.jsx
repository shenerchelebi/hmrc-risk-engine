import { useState, useEffect, useMemo } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, ArrowLeft, Lock, Users, FileText, PoundSterling, TrendingUp, Download, Loader2, LogOut, UserPlus, Filter, X, Calendar, Building2, AlertTriangle, Eye, RefreshCw } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const INDUSTRIES = [
  { id: "all", name: "All Industries" },
  { id: "phv_taxi", name: "PHV / Taxi / Uber" },
  { id: "construction_cis", name: "Construction / CIS" },
  { id: "cleaning", name: "Cleaning Services" },
  { id: "retail", name: "Retail" },
  { id: "consultant_it", name: "Consultant / IT" },
  { id: "other", name: "Other / General" }
];

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
  
  // Filters
  const [filters, setFilters] = useState({
    industry: "all",
    riskBand: "all",
    paymentStatus: "all",
    dateFrom: "",
    dateTo: ""
  });
  const [showFilters, setShowFilters] = useState(false);

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

  const clearFilters = () => {
    setFilters({ industry: "all", riskBand: "all", paymentStatus: "all", dateFrom: "", dateTo: "" });
  };

  const hasActiveFilters = filters.industry !== "all" || filters.riskBand !== "all" || 
    filters.paymentStatus !== "all" || filters.dateFrom || filters.dateTo;

  // Filtered assessments
  const filteredAssessments = useMemo(() => {
    return assessments.filter(a => {
      if (filters.industry !== "all" && a.industry !== filters.industry) return false;
      if (filters.riskBand !== "all" && a.risk_band !== filters.riskBand) return false;
      if (filters.paymentStatus !== "all" && a.payment_status !== filters.paymentStatus) return false;
      if (filters.dateFrom) {
        const assessmentDate = new Date(a.created_at);
        const fromDate = new Date(filters.dateFrom);
        if (assessmentDate < fromDate) return false;
      }
      if (filters.dateTo) {
        const assessmentDate = new Date(a.created_at);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59);
        if (assessmentDate > toDate) return false;
      }
      return true;
    });
  }, [assessments, filters]);

  // Filtered stats
  const filteredStats = useMemo(() => {
    const filtered = filteredAssessments;
    const total = filtered.length;
    const paid = filtered.filter(a => a.payment_status === 'paid').length;
    const preview = total - paid;
    const revenue = filtered.filter(a => a.payment_status === 'paid').reduce((sum, a) => sum + (a.payment_amount || 29.99), 0);
    return { total, paid, preview, revenue, conversionRate: total > 0 ? ((paid / total) * 100).toFixed(1) : 0 };
  }, [filteredAssessments]);

  const getRiskBadge = (band) => {
    const styles = {
      LOW: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
      MODERATE: "bg-amber-500/20 text-amber-400 border-amber-500/50",
      HIGH: "bg-rose-500/20 text-rose-400 border-rose-500/50"
    };
    return <Badge className={`${styles[band] || "bg-zinc-500/20 text-zinc-400"} border`}>{band}</Badge>;
  };

  const getPaymentBadge = (status) => {
    if (status === 'paid') {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 border flex items-center gap-1"><FileText className="h-3 w-3" />Paid</Badge>;
    }
    return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/50 border flex items-center gap-1"><Eye className="h-3 w-3" />Preview</Badge>;
  };

  // Login/Register UI
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
        <header className="bg-[#0d0d14] border-b border-zinc-800 px-6 md:px-12 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" /><span>Back</span>
            </button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-500" />
              <span className="font-serif font-semibold text-white">Admin Portal</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="bg-zinc-900/50 border-zinc-800 w-full max-w-md">
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
                    <Input type="text" placeholder="admin" value={registerData.username}
                      onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                      className="h-12 bg-zinc-800/50 border-zinc-700 text-white" data-testid="register-username-input" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Email</Label>
                    <Input type="email" placeholder="admin@company.com" value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      className="h-12 bg-zinc-800/50 border-zinc-700 text-white" data-testid="register-email-input" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Password</Label>
                    <Input type="password" placeholder="••••••••" value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      className="h-12 bg-zinc-800/50 border-zinc-700 text-white" data-testid="register-password-input" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Admin Secret Key</Label>
                    <Input type="password" placeholder="Secret key" value={registerData.admin_secret}
                      onChange={(e) => setRegisterData({ ...registerData, admin_secret: e.target.value })}
                      className="h-12 bg-zinc-800/50 border-zinc-700 text-white" data-testid="register-secret-input" />
                    <p className="text-xs text-zinc-600">Contact your system administrator for the secret key</p>
                  </div>
                  <Button type="submit" className="w-full h-12 bg-teal-600 hover:bg-teal-500" disabled={loginLoading} data-testid="register-submit-btn">
                    {loginLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Account"}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full text-zinc-500 hover:text-white" onClick={() => setShowRegister(false)}>
                    Already have an account? Login
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Username</Label>
                    <Input type="text" placeholder="admin" value={loginData.username}
                      onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                      className="h-12 bg-zinc-800/50 border-zinc-700 text-white" data-testid="admin-username-input" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Password</Label>
                    <Input type="password" placeholder="••••••••" value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="h-12 bg-zinc-800/50 border-zinc-700 text-white" data-testid="admin-password-input" />
                  </div>
                  <Button type="submit" className="w-full h-12 bg-teal-600 hover:bg-teal-500" disabled={loginLoading} data-testid="admin-login-btn">
                    {loginLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Login"}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full text-zinc-500 hover:text-white" onClick={() => setShowRegister(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />Create Admin Account
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="bg-[#0d0d14] border-b border-zinc-800 px-6 md:px-12 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/20 border border-teal-500/30">
              <Shield className="h-5 w-5 text-teal-400" />
            </div>
            <span className="font-serif font-semibold text-white">HMRC Risk Engine</span>
            <Badge className="bg-teal-500/20 text-teal-400 border border-teal-500/30">Admin</Badge>
          </div>
          <div className="flex items-center gap-3">
            {adminInfo && (
              <span className="text-zinc-500 text-sm hidden md:block">
                <span className="text-white">{adminInfo.username}</span>
              </span>
            )}
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800" onClick={fetchData} data-testid="refresh-btn">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white" onClick={handleLogout} data-testid="logout-btn">
              <LogOut className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="px-6 md:px-12 py-6">
        <div className="max-w-7xl mx-auto">
          {loading && !stats ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
            </div>
          ) : (
            <>
              {/* Overview Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center">
                        <Users className="h-5 w-5 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Total</p>
                        <p className="text-xl font-bold text-white" data-testid="stat-total">{hasActiveFilters ? filteredStats.total : stats?.total_assessments || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Paid</p>
                        <p className="text-xl font-bold text-emerald-400" data-testid="stat-paid">{hasActiveFilters ? filteredStats.paid : stats?.paid_assessments || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-700/50 rounded-lg flex items-center justify-center">
                        <Eye className="h-5 w-5 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Preview</p>
                        <p className="text-xl font-bold text-zinc-400">{hasActiveFilters ? filteredStats.preview : (stats?.total_assessments || 0) - (stats?.paid_assessments || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-teal-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Conversion</p>
                        <p className="text-xl font-bold text-teal-400" data-testid="stat-conversion">{hasActiveFilters ? filteredStats.conversionRate : stats?.conversion_rate || 0}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                        <PoundSterling className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Revenue</p>
                        <p className="text-xl font-bold text-amber-400" data-testid="stat-revenue">£{(hasActiveFilters ? filteredStats.revenue : stats?.total_revenue || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Risk + Industry Breakdown */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-zinc-400">Risk Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                        <span className="text-zinc-500 text-sm">Low:</span>
                        <span className="font-semibold text-white">{stats?.risk_breakdown?.low || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                        <span className="text-zinc-500 text-sm">Moderate:</span>
                        <span className="font-semibold text-white">{stats?.risk_breakdown?.moderate || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                        <span className="text-zinc-500 text-sm">High:</span>
                        <span className="font-semibold text-white">{stats?.risk_breakdown?.high || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-zinc-400">Top Industries</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {stats?.industry_breakdown && Object.entries(stats.industry_breakdown)
                        .sort(([,a], [,b]) => b.count - a.count)
                        .slice(0, 4)
                        .map(([id, data]) => (
                          <Badge key={id} className="bg-zinc-800 text-zinc-300 border-zinc-700 border">
                            {data.name}: {data.count}
                          </Badge>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-zinc-500" />
                      <CardTitle className="text-sm font-medium text-zinc-400">Filters</CardTitle>
                      {hasActiveFilters && (
                        <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30 border text-xs">Active</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-zinc-500 hover:text-white text-xs">
                          <X className="h-3 w-3 mr-1" />Clear
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)} className="text-zinc-500 hover:text-white text-xs">
                        {showFilters ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {showFilters && (
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <Label className="text-xs text-zinc-500 mb-1.5 block">Industry</Label>
                        <Select value={filters.industry} onValueChange={(v) => setFilters({...filters, industry: v})}>
                          <SelectTrigger className="bg-zinc-800/50 border-zinc-700 text-zinc-300 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-700">
                            {INDUSTRIES.map(i => (
                              <SelectItem key={i.id} value={i.id} className="text-zinc-300">{i.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500 mb-1.5 block">Risk Band</Label>
                        <Select value={filters.riskBand} onValueChange={(v) => setFilters({...filters, riskBand: v})}>
                          <SelectTrigger className="bg-zinc-800/50 border-zinc-700 text-zinc-300 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-700">
                            <SelectItem value="all" className="text-zinc-300">All Bands</SelectItem>
                            <SelectItem value="LOW" className="text-emerald-400">Low</SelectItem>
                            <SelectItem value="MODERATE" className="text-amber-400">Moderate</SelectItem>
                            <SelectItem value="HIGH" className="text-rose-400">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500 mb-1.5 block">Payment Status</Label>
                        <Select value={filters.paymentStatus} onValueChange={(v) => setFilters({...filters, paymentStatus: v})}>
                          <SelectTrigger className="bg-zinc-800/50 border-zinc-700 text-zinc-300 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-700">
                            <SelectItem value="all" className="text-zinc-300">All Status</SelectItem>
                            <SelectItem value="paid" className="text-emerald-400">Paid</SelectItem>
                            <SelectItem value="pending" className="text-zinc-400">Preview</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500 mb-1.5 block">From Date</Label>
                        <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                          className="bg-zinc-800/50 border-zinc-700 text-zinc-300 h-9" />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500 mb-1.5 block">To Date</Label>
                        <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                          className="bg-zinc-800/50 border-zinc-700 text-zinc-300 h-9" />
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Tabs: Assessments & Transactions */}
              <Tabs defaultValue="assessments" className="space-y-4">
                <TabsList className="bg-zinc-900 border border-zinc-800">
                  <TabsTrigger value="assessments" className="data-[state=active]:bg-zinc-800" data-testid="tab-assessments">
                    Assessments ({filteredAssessments.length})
                  </TabsTrigger>
                  <TabsTrigger value="transactions" className="data-[state=active]:bg-zinc-800" data-testid="tab-transactions">
                    Payments ({transactions.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="assessments">
                  <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-zinc-800 hover:bg-transparent">
                              <TableHead className="text-zinc-500 text-xs">Date</TableHead>
                              <TableHead className="text-zinc-500 text-xs">Email</TableHead>
                              <TableHead className="text-zinc-500 text-xs">Industry</TableHead>
                              <TableHead className="text-zinc-500 text-xs">Year</TableHead>
                              <TableHead className="text-zinc-500 text-xs">Turnover</TableHead>
                              <TableHead className="text-zinc-500 text-xs">Score</TableHead>
                              <TableHead className="text-zinc-500 text-xs">Risk</TableHead>
                              <TableHead className="text-zinc-500 text-xs">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAssessments.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-zinc-600">
                                  {hasActiveFilters ? "No assessments match filters" : "No assessments yet"}
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredAssessments.slice(0, 50).map((a) => (
                                <TableRow key={a.id} className="border-zinc-800 hover:bg-zinc-800/30">
                                  <TableCell className="text-xs text-zinc-500">
                                    {new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                  </TableCell>
                                  <TableCell className="text-xs font-mono text-zinc-400 max-w-[150px] truncate">{a.email}</TableCell>
                                  <TableCell className="text-xs text-zinc-400">{a.industry_name || 'General'}</TableCell>
                                  <TableCell className="text-xs text-zinc-300">{a.tax_year}</TableCell>
                                  <TableCell className="text-xs text-zinc-300">£{a.turnover?.toLocaleString()}</TableCell>
                                  <TableCell className="font-semibold text-white">{a.risk_score}</TableCell>
                                  <TableCell>{getRiskBadge(a.risk_band)}</TableCell>
                                  <TableCell>{getPaymentBadge(a.payment_status)}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      {filteredAssessments.length > 50 && (
                        <div className="p-3 border-t border-zinc-800 text-center text-zinc-500 text-xs">
                          Showing 50 of {filteredAssessments.length} assessments
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="transactions">
                  <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-zinc-800 hover:bg-transparent">
                              <TableHead className="text-zinc-500 text-xs">Date</TableHead>
                              <TableHead className="text-zinc-500 text-xs">Email</TableHead>
                              <TableHead className="text-zinc-500 text-xs">Assessment</TableHead>
                              <TableHead className="text-zinc-500 text-xs">Amount</TableHead>
                              <TableHead className="text-zinc-500 text-xs">Status</TableHead>
                              <TableHead className="text-zinc-500 text-xs">Session ID</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transactions.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-zinc-600">
                                  No transactions yet
                                </TableCell>
                              </TableRow>
                            ) : (
                              transactions.slice(0, 50).map((t) => (
                                <TableRow key={t.id} className="border-zinc-800 hover:bg-zinc-800/30">
                                  <TableCell className="text-xs text-zinc-500">
                                    {new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                  </TableCell>
                                  <TableCell className="text-xs font-mono text-zinc-400">{t.email}</TableCell>
                                  <TableCell className="text-xs font-mono text-zinc-500">{t.assessment_id?.slice(0, 8)}...</TableCell>
                                  <TableCell className="text-xs font-semibold text-white">£{t.amount?.toFixed(2)}</TableCell>
                                  <TableCell>
                                    <Badge className={`border text-xs ${
                                      t.payment_status === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' :
                                      t.payment_status === 'initiated' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' :
                                      'bg-zinc-500/20 text-zinc-400 border-zinc-500/50'
                                    }`}>{t.payment_status}</Badge>
                                  </TableCell>
                                  <TableCell className="text-xs font-mono text-zinc-600">{t.session_id?.slice(0, 12)}...</TableCell>
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
