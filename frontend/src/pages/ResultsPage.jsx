import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowLeft, FileText, Lock, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ResultsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    fetchAssessment();
  }, [id]);

  const fetchAssessment = async () => {
    try {
      const response = await axios.get(`${API}/assessment/${id}`);
      setAssessment(response.data);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to load assessment");
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    setCheckoutLoading(true);
    try {
      const response = await axios.post(`${API}/checkout/create`, {
        assessment_id: id,
        origin_url: window.location.origin
      });
      
      window.location.href = response.data.checkout_url;
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error(error.response?.data?.detail || "Failed to create checkout session");
      setCheckoutLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      window.open(`${API}/report/download/${id}`, '_blank');
    } catch (error) {
      toast.error("Failed to download report");
    }
  };

  const getRiskColor = (band) => {
    switch (band) {
      case 'LOW': return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/50', glow: 'glow-emerald', pulse: 'risk-pulse-low' };
      case 'MODERATE': return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/50', glow: 'glow-amber', pulse: 'risk-pulse-moderate' };
      case 'HIGH': return { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/50', glow: 'glow-rose', pulse: 'risk-pulse-high' };
      default: return { bg: 'bg-zinc-500/20', text: 'text-zinc-400', border: 'border-zinc-500/50', glow: '', pulse: '' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-6">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h1 className="font-serif text-2xl font-bold text-white mb-2">Assessment Not Found</h1>
        <p className="text-zinc-500 mb-6">The assessment you're looking for doesn't exist.</p>
        <Button onClick={() => navigate('/')} className="bg-teal-600 hover:bg-teal-500" data-testid="go-home-btn">
          Go Home
        </Button>
      </div>
    );
  }

  const riskColors = getRiskColor(assessment.risk_band);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="bg-[#0d0d14] border-b border-zinc-800 px-6 md:px-12 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
            data-testid="back-home-btn"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Home</span>
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-500" />
            <span className="font-serif font-semibold text-white">HMRC Red-Flag Detector</span>
          </div>
        </div>
      </header>

      {/* Results */}
      <main className="px-6 md:px-12 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Score Card */}
          <Card className="card-dark border-zinc-800 overflow-hidden mb-8">
            <div className={`h-1 ${riskColors.bg}`}></div>
            <CardContent className="p-8 md:p-12 text-center">
              <p className="text-zinc-500 mb-4">Your HMRC Risk Score</p>
              
              <div className={`score-circle inline-flex items-center justify-center w-44 h-44 rounded-full ${riskColors.bg} ${riskColors.border} border-4 ${riskColors.glow} ${riskColors.pulse} mb-6`}>
                <div className="text-center">
                  <span className={`text-5xl font-bold ${riskColors.text}`} data-testid="risk-score">
                    {assessment.risk_score}
                  </span>
                  <span className={`text-2xl ${riskColors.text}`}>/100</span>
                </div>
              </div>

              <Badge 
                className={`${riskColors.bg} ${riskColors.text} ${riskColors.border} border text-lg px-6 py-2 mb-6`}
                data-testid="risk-band"
              >
                {assessment.risk_band} RISK
              </Badge>

              <p className="text-zinc-500 max-w-md mx-auto">
                {assessment.risk_band === 'LOW' && "Your figures appear within normal ranges. Low likelihood of HMRC enquiry."}
                {assessment.risk_band === 'MODERATE' && "Some figures may warrant attention. Consider reviewing your records."}
                {assessment.risk_band === 'HIGH' && "Several indicators suggest higher scrutiny risk. Professional advice recommended."}
              </p>
            </CardContent>
          </Card>

          {/* Summary Card */}
          <Card className="card-dark border-zinc-800 mb-8">
            <CardContent className="p-8">
              <h3 className="font-serif text-xl font-semibold text-white mb-6">Assessment Summary</h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-zinc-800">
                    <span className="text-zinc-500">Tax Year</span>
                    <span className="font-medium text-white">{assessment.tax_year}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-800">
                    <span className="text-zinc-500">Turnover</span>
                    <span className="font-medium text-white">£{assessment.turnover?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-800">
                    <span className="text-zinc-500">Profit</span>
                    <span className="font-medium text-white">£{assessment.profit?.toLocaleString()}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-zinc-800">
                    <span className="text-zinc-500">Risk Indicators</span>
                    <span className="font-medium text-white">{assessment.triggered_rules_count} triggered</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-800">
                    <span className="text-zinc-500">Email</span>
                    <span className="font-medium text-white text-sm">{assessment.email}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-800">
                    <span className="text-zinc-500">Report Status</span>
                    <span className={`font-medium ${assessment.payment_status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {assessment.payment_status === 'paid' ? 'Purchased' : 'Free Tier'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upgrade CTA or Download */}
          {assessment.payment_status === 'paid' ? (
            <Card className="card-dark border-zinc-800 border-l-4 border-l-emerald-500">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-emerald-500/20">
                    <CheckCircle className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-serif text-xl font-semibold text-white mb-2">
                      Your Full Report is Ready
                    </h3>
                    <p className="text-zinc-500 mb-4">
                      Download your detailed AI-powered risk analysis report. A copy has also been sent to your email.
                    </p>
                    <Button 
                      onClick={handleDownload}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white"
                      data-testid="download-report-btn"
                    >
                      <FileText className="mr-2 h-5 w-5" />
                      Download PDF Report
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="card-dark border-zinc-800 border-l-4 border-l-teal-500">
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-1">
                    <h3 className="font-serif text-xl font-semibold text-white mb-2">
                      Unlock Your Full HMRC Risk Report
                    </h3>
                    <p className="text-zinc-500 mb-4">
                      Get a detailed AI-powered analysis including:
                    </p>
                    <ul className="space-y-2 text-sm text-zinc-400">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-teal-500" />
                        Detailed breakdown of each risk indicator
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-teal-500" />
                        What HMRC typically examines in similar cases
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-teal-500" />
                        Document checklist for your records
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-teal-500" />
                        PDF report delivered to your email
                      </li>
                    </ul>
                  </div>
                  <div className="text-center md:text-right">
                    <p className="text-3xl font-bold text-white mb-2">£19.99</p>
                    <p className="text-sm text-zinc-600 mb-4">One-time payment</p>
                    <Button
                      onClick={handlePurchase}
                      disabled={checkoutLoading}
                      className="bg-teal-600 hover:bg-teal-500 text-white px-8 py-6 text-lg rounded-xl w-full md:w-auto glow-teal"
                      data-testid="purchase-report-btn"
                    >
                      {checkoutLoading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-5 w-5" />
                          Get Full Report
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-zinc-600 text-center mt-8 max-w-lg mx-auto">
            This tool provides an automated risk indicator based on user-entered figures and public 
            statistical patterns. It does not provide tax advice and does not submit or amend tax returns.
          </p>
        </div>
      </main>
    </div>
  );
};

export default ResultsPage;
