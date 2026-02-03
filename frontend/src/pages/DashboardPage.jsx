import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowLeft, Mail, Loader2, LogOut, FileText, Download, Clock, Eye, CheckCircle, Lock, ExternalLink } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DashboardPage = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [email, setEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('user_token');
    if (token) {
      try {
        // Decode token to get email (simple JWT decode)
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserEmail(payload.email || '');
        setIsAuthenticated(true);
        await fetchAssessments(token);
      } catch (e) {
        localStorage.removeItem('user_token');
        setIsAuthenticated(false);
      }
    }
    setLoading(false);
  };

  const fetchAssessments = async (token) => {
    try {
      const response = await axios.get(`${API}/user/assessments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAssessments(response.data.assessments || []);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('user_token');
        setIsAuthenticated(false);
        toast.error("Session expired. Please login again.");
      }
    }
  };

  const handleRequestLink = async (e) => {
    e.preventDefault();
    setSendingLink(true);
    try {
      const response = await axios.post(`${API}/auth/magic-link`, { email });
      setLinkSent(true);
      toast.success("Login link sent to your email!");
      
      // If token returned (email not configured), auto-login for demo
      if (response.data.token) {
        toast.info("Demo mode - logging in directly");
        const verifyResponse = await axios.post(`${API}/auth/verify`, { token: response.data.token });
        if (verifyResponse.data.access_token) {
          localStorage.setItem('user_token', verifyResponse.data.access_token);
          const payload = JSON.parse(atob(verifyResponse.data.access_token.split('.')[1]));
          setUserEmail(payload.email || email);
          setIsAuthenticated(true);
          await fetchAssessments(verifyResponse.data.access_token);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send link");
    } finally {
      setSendingLink(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user_token');
    setIsAuthenticated(false);
    setAssessments([]);
    setUserEmail("");
    toast.success("Logged out successfully");
  };

  const handleDownload = (assessmentId) => {
    window.open(`${API}/report/download/${assessmentId}`, '_blank');
  };

  // Risk band badge
  const getRiskBadge = (band) => {
    const styles = {
      LOW: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      MODERATE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      HIGH: "bg-rose-500/20 text-rose-400 border-rose-500/30"
    };
    return <Badge className={`${styles[band] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"} border`}>{band}</Badge>;
  };

  // Status badge with icon
  const getStatusBadge = (assessment) => {
    if (assessment.payment_status === 'paid') {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border flex items-center gap-1">
          <FileText className="h-3 w-3" />
          PDF Ready
        </Badge>
      );
    }
    return (
      <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 border flex items-center gap-1">
        <Eye className="h-3 w-3" />
        Preview
      </Badge>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    );
  }

  // Not authenticated - show login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
        <header className="bg-[#0d0d14] border-b border-zinc-800 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" /><span>Back</span>
            </button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-500" />
              <span className="font-serif font-semibold text-white">My Account</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="bg-zinc-900/50 border-zinc-800 w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-teal-500/20 border border-teal-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-teal-400" />
              </div>
              <CardTitle className="font-serif text-2xl text-white">
                {linkSent ? "Check Your Email" : "Sign In"}
              </CardTitle>
              <CardDescription className="text-zinc-500">
                {linkSent 
                  ? "We've sent a login link to your email. Click it to access your assessments." 
                  : "Enter your email to receive a magic login link. No password required."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!linkSent ? (
                <form onSubmit={handleRequestLink} className="space-y-4">
                  <div>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-600"
                      required
                      data-testid="email-input"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-teal-600 hover:bg-teal-500" 
                    disabled={sendingLink}
                    data-testid="send-link-btn"
                  >
                    {sendingLink ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Send Login Link
                      </>
                    )}
                  </Button>
                  <p className="text-zinc-600 text-xs text-center mt-3">
                    We'll send a secure, one-time link to your email. No password needed.
                  </p>
                </form>
              ) : (
                <div className="text-center space-y-4">
                  <div className="p-4 rounded-lg bg-teal-950/30 border border-teal-800/30">
                    <CheckCircle className="h-8 w-8 text-teal-500 mx-auto mb-3" />
                    <p className="text-teal-400 text-sm font-medium">Link sent to {email}</p>
                  </div>
                  <p className="text-zinc-500 text-sm">
                    Didn't receive it? Check your spam folder.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setLinkSent(false)} 
                    className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
                  >
                    Try Different Email
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Authenticated - show dashboard
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="bg-[#0d0d14] border-b border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-500" />
              <span className="font-serif font-semibold text-white">My Assessments</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-zinc-500 text-sm hidden md:block">{userEmail}</span>
            <Button onClick={() => navigate('/assess')} className="bg-teal-600 hover:bg-teal-500" data-testid="new-assessment-btn">
              New Assessment
            </Button>
            <Button 
              variant="outline" 
              onClick={handleLogout} 
              className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
              data-testid="logout-btn"
            >
              <LogOut className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="px-6 py-8">
        <div className="max-w-5xl mx-auto">
          
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-white">{assessments.length}</div>
                <div className="text-zinc-500 text-xs">Total Assessments</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-emerald-400">
                  {assessments.filter(a => a.payment_status === 'paid').length}
                </div>
                <div className="text-zinc-500 text-xs">Reports Purchased</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-zinc-400">
                  {assessments.filter(a => a.payment_status !== 'paid').length}
                </div>
                <div className="text-zinc-500 text-xs">Free Previews</div>
              </CardContent>
            </Card>
          </div>

          {/* Assessments List */}
          {assessments.length === 0 ? (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="py-16 text-center">
                <FileText className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="font-serif text-xl text-white mb-2">No Assessments Yet</h3>
                <p className="text-zinc-500 mb-6">Start your first risk assessment to see your history here.</p>
                <Button onClick={() => navigate('/assess')} className="bg-teal-600 hover:bg-teal-500">
                  Start Assessment
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {assessments.map((assessment) => (
                <Card key={assessment.id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      
                      {/* Left: Assessment Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-white">{assessment.tax_year}</span>
                          <span className="text-zinc-600">•</span>
                          <span className="text-zinc-400">{assessment.industry_name || 'General'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-1.5 text-zinc-500">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(assessment.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>
                      
                      {/* Middle: Score + Risk */}
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white">{assessment.risk_score}</div>
                          <div className="text-zinc-600 text-xs">Score</div>
                        </div>
                        <div className="text-center">
                          {getRiskBadge(assessment.risk_band)}
                        </div>
                      </div>
                      
                      {/* Right: Status + Actions */}
                      <div className="flex items-center gap-3">
                        {getStatusBadge(assessment)}
                        
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
                            onClick={() => navigate(`/results/${assessment.id}`)}
                            data-testid={`view-assessment-${assessment.id}`}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          
                          {assessment.payment_status === 'paid' ? (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-500"
                              onClick={() => handleDownload(assessment.id)}
                              data-testid={`download-pdf-${assessment.id}`}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-teal-700 text-teal-400 hover:bg-teal-950"
                              onClick={() => navigate(`/results/${assessment.id}`)}
                            >
                              <Lock className="h-4 w-4 mr-1" />
                              Unlock
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {/* Footer Help */}
          <div className="mt-8 text-center">
            <p className="text-zinc-600 text-xs">
              Need help? Contact support or start a new assessment.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
