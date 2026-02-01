import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, ArrowLeft, Mail, Loader2, LogOut, FileText, Download, Clock } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DashboardPage = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('user_token');
    if (token) {
      setIsAuthenticated(true);
      fetchAssessments(token);
    }
  }, []);

  const fetchAssessments = async (token) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/user/assessments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAssessments(response.data.assessments || []);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('user_token');
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
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
        toast.info("Email not configured - using direct link");
        const verifyResponse = await axios.post(`${API}/auth/verify`, { token: response.data.token });
        if (verifyResponse.data.access_token) {
          localStorage.setItem('user_token', verifyResponse.data.access_token);
          setIsAuthenticated(true);
          fetchAssessments(verifyResponse.data.access_token);
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
  };

  const getRiskBadge = (band) => {
    const styles = {
      LOW: "bg-emerald-500/20 text-emerald-400",
      MODERATE: "bg-amber-500/20 text-amber-400",
      HIGH: "bg-rose-500/20 text-rose-400"
    };
    return <Badge className={styles[band] || "bg-zinc-500/20 text-zinc-400"}>{band}</Badge>;
  };

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
          <Card className="card-dark border-zinc-800 w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-teal-500/20 border border-teal-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-teal-400" />
              </div>
              <CardTitle className="font-serif text-2xl text-white">
                {linkSent ? "Check Your Email" : "Sign In"}
              </CardTitle>
              <CardDescription className="text-zinc-500">
                {linkSent ? "We've sent a login link to your email" : "Enter your email to receive a magic login link"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!linkSent ? (
                <form onSubmit={handleRequestLink} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 bg-zinc-900 border-zinc-700 text-white"
                    required
                  />
                  <Button type="submit" className="w-full h-12 bg-teal-600 hover:bg-teal-500" disabled={sendingLink}>
                    {sendingLink ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Login Link"}
                  </Button>
                </form>
              ) : (
                <div className="text-center">
                  <p className="text-zinc-400 mb-4">Didn't receive it? Check your spam folder or</p>
                  <Button variant="outline" onClick={() => setLinkSent(false)} className="border-zinc-700 text-zinc-400 hover:text-white">
                    Try Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="bg-[#0d0d14] border-b border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-500" />
            <span className="font-serif font-semibold text-white">My Assessments</span>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate('/assess')} className="bg-teal-600 hover:bg-teal-500">
              New Assessment
            </Button>
            <Button variant="outline" onClick={handleLogout} className="border-zinc-700 text-zinc-400 hover:text-white">
              <LogOut className="h-4 w-4 mr-2" />Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="px-6 py-8">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
            </div>
          ) : assessments.length === 0 ? (
            <Card className="card-dark border-zinc-800">
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
            <Card className="card-dark border-zinc-800">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400">Date</TableHead>
                      <TableHead className="text-zinc-400">Tax Year</TableHead>
                      <TableHead className="text-zinc-400">Industry</TableHead>
                      <TableHead className="text-zinc-400">Score</TableHead>
                      <TableHead className="text-zinc-400">Risk</TableHead>
                      <TableHead className="text-zinc-400">Status</TableHead>
                      <TableHead className="text-zinc-400"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assessments.map((a) => (
                      <TableRow key={a.id} className="border-zinc-800 hover:bg-zinc-800/50">
                        <TableCell className="text-zinc-400 text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {new Date(a.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-white">{a.tax_year}</TableCell>
                        <TableCell className="text-zinc-300">{a.industry_name || 'General'}</TableCell>
                        <TableCell className="font-semibold text-white">{a.risk_score}</TableCell>
                        <TableCell>{getRiskBadge(a.risk_band)}</TableCell>
                        <TableCell>
                          <Badge className={a.payment_status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-500/20 text-zinc-400'}>
                            {a.payment_status === 'paid' ? 'Purchased' : 'Free'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-teal-400 hover:text-teal-300"
                            onClick={() => navigate(`/results/${a.id}`)}
                          >
                            View
                          </Button>
                          {a.payment_status === 'paid' && (
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
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
