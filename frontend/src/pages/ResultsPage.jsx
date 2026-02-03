import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Shield, ArrowLeft, FileText, Lock, CheckCircle, AlertTriangle, Loader2, Building2, Info, SlidersHorizontal, RotateCcw, TrendingUp, TrendingDown, Minus, Eye } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ResultsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Preview mode - STRICT CONTROLS
  // 1. Only enabled via URL param (no persistence)
  // 2. Blocked in production unless REACT_APP_ALLOW_PREVIEW=true
  // 3. Frontend-only - backend still enforces payment for PDF
  const previewParam = searchParams.get("preview") === "1";
  const isNonProd = process.env.NODE_ENV !== "production";
  const allowlistEnabled = process.env.REACT_APP_ALLOW_PREVIEW === "true";
  const isPreview = previewParam && (isNonProd || allowlistEnabled);
  
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simData, setSimData] = useState({});
  const [simResult, setSimResult] = useState(null);

  useEffect(() => {
    fetchAssessment();
  }, [id]);

  const fetchAssessment = async () => {
    try {
      const response = await axios.get(`${API}/assessment/${id}`);
      setAssessment(response.data);
      setSimData({
        total_expenses: response.data.total_expenses,
        motor_costs: response.data.motor_costs,
        mileage_claimed: response.data.mileage_claimed,
        loss_this_year: response.data.loss_this_year
      });
    } catch (error) {
      toast.error("Failed to load assessment");
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = async () => {
    setSimulating(true);
    try {
      const response = await axios.post(`${API}/assessment/simulate`, {
        assessment_id: id,
        ...simData
      });
      setSimResult(response.data);
    } catch (error) {
      toast.error("Simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  const resetSimulation = () => {
    setSimData({
      total_expenses: assessment.total_expenses,
      motor_costs: assessment.motor_costs,
      mileage_claimed: assessment.mileage_claimed,
      loss_this_year: assessment.loss_this_year
    });
    setSimResult(null);
  };

  const handlePurchase = async () => {
    setCheckoutLoading(true);
    try {
      const response = await axios.post(`${API}/checkout/create`, {
        assessment_id: id,
        origin_url: window.location.origin,
        report_type: assessment.report_type || 'v2_pro'
      });
      window.location.href = response.data.checkout_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || "Checkout failed");
      setCheckoutLoading(false);
    }
  };

  const handleDownload = () => {
    window.open(`${API}/report/download/${id}`, '_blank');
  };

  const getRiskStyles = (band) => {
    switch (band) {
      case 'LOW': 
        return { 
          bg: 'bg-emerald-900/30', 
          text: 'text-emerald-400', 
          border: 'border-emerald-600/40',
          accent: 'emerald',
          label: 'Low Risk Signal'
        };
      case 'MODERATE': 
        return { 
          bg: 'bg-amber-900/30', 
          text: 'text-amber-400', 
          border: 'border-amber-600/40',
          accent: 'amber',
          label: 'Moderate Risk Signal'
        };
      case 'HIGH': 
        return { 
          bg: 'bg-rose-900/30', 
          text: 'text-rose-400', 
          border: 'border-rose-600/40',
          accent: 'rose',
          label: 'Elevated Risk Signal'
        };
      default: 
        return { 
          bg: 'bg-zinc-800/50', 
          text: 'text-zinc-400', 
          border: 'border-zinc-700',
          accent: 'zinc',
          label: 'Risk Signal'
        };
    }
  };

  const getWeightLabel = (weight) => {
    switch (weight) {
      case 'high': return { text: 'Higher Weight', color: 'text-rose-400 bg-rose-950/50 border-rose-800/30' };
      case 'medium': return { text: 'Medium Weight', color: 'text-amber-400 bg-amber-950/50 border-amber-800/30' };
      case 'low': return { text: 'Lower Weight', color: 'text-emerald-400 bg-emerald-950/50 border-emerald-800/30' };
      default: return { text: 'Standard', color: 'text-zinc-400 bg-zinc-800/50 border-zinc-700' };
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
        <Button onClick={() => navigate('/')} className="bg-teal-600 hover:bg-teal-500">Return Home</Button>
      </div>
    );
  }

  const originalStyles = getRiskStyles(assessment.risk_band);
  const displayScore = simResult ? simResult.simulated_score : assessment.risk_score;
  const displayBand = simResult ? simResult.simulated_band : assessment.risk_band;
  const displayStyles = getRiskStyles(displayBand);
  const triggeredIndicators = (assessment.risk_indicators || []).filter(i => i.triggered);
  const simTriggered = simResult ? simResult.triggered_indicators : triggeredIndicators;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Preview Mode Banner */}
      {isPreview && (
        <div className="bg-amber-900/30 border-b border-amber-700/50 px-6 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-center gap-2">
            <Eye className="h-4 w-4 text-amber-400" />
            <span className="text-amber-400 text-sm font-medium">Preview Mode – Payment Disabled</span>
          </div>
        </div>
      )}
      
      <header className="bg-[#0d0d14] border-b border-zinc-800/80 px-6 md:px-12 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors" data-testid="back-home-btn">
            <ArrowLeft className="h-5 w-5" /><span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-500" />
            <span className="font-serif font-semibold text-white">HMRC Risk Engine</span>
          </div>
        </div>
      </header>

      <main className="px-6 md:px-12 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Primary Column - Risk Score */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Risk Score Card - Primary Visual Focus */}
              <Card className={`border ${displayStyles.border} ${displayStyles.bg} overflow-hidden`}>
                <CardContent className="p-8 md:p-10">
                  <div className="flex flex-col items-center">
                    
                    {/* Industry Context */}
                    <div className="flex items-center gap-2 mb-6 text-zinc-500 text-sm">
                      <Building2 className="h-4 w-4" />
                      <span>{assessment.industry_name || 'General'} sector analysis</span>
                    </div>
                    
                    {/* Score Display - Primary Focus */}
                    <div className="relative mb-6">
                      <div className={`w-44 h-44 rounded-full ${displayStyles.bg} ${displayStyles.border} border-2 flex items-center justify-center`}>
                        <div className="text-center">
                          <div className={`text-6xl font-bold tracking-tight ${displayStyles.text}`} data-testid="risk-score">
                            {displayScore}
                          </div>
                          <div className="text-zinc-500 text-sm mt-1">out of 100</div>
                        </div>
                      </div>
                      {simResult && (
                        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${
                          simResult.score_change > 0 
                            ? 'bg-rose-950/80 text-rose-400 border border-rose-800/50' 
                            : simResult.score_change < 0 
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}>
                          {simResult.score_change > 0 ? <TrendingUp className="h-3 w-3" /> : simResult.score_change < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          {simResult.score_change > 0 ? '+' : ''}{simResult.score_change}
                        </div>
                      )}
                    </div>

                    {/* Risk Band Label */}
                    <Badge className={`${displayStyles.bg} ${displayStyles.text} ${displayStyles.border} border text-base px-5 py-1.5 font-medium`} data-testid="risk-band">
                      {displayStyles.label}
                    </Badge>

                    {/* Contextual Description */}
                    <p className="text-zinc-500 text-sm text-center mt-6 max-w-sm leading-relaxed">
                      {displayBand === 'LOW' && "Your figures fall within typical ranges. This profile may attract less routine scrutiny."}
                      {displayBand === 'MODERATE' && "Some figures may warrant attention. Keeping detailed records is advisable."}
                      {displayBand === 'HIGH' && "Several indicators may attract review. Professional record-keeping is recommended."}
                    </p>

                    {/* Simulation Comparison */}
                    {simResult && (
                      <div className="mt-6 pt-6 border-t border-zinc-800/50 w-full">
                        <div className="flex justify-center gap-8 text-sm">
                          <div className="text-center">
                            <div className="text-zinc-500 mb-1">Original</div>
                            <div className={`font-semibold ${originalStyles.text}`}>{assessment.risk_score} - {assessment.risk_band}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-zinc-500 mb-1">Simulated</div>
                            <div className={`font-semibold ${displayStyles.text}`}>{simResult.simulated_score} - {simResult.simulated_band}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Risk Transparency Panel */}
              <Card className="border border-zinc-800/60 bg-zinc-900/40">
                <CardHeader className="pb-4">
                  <CardTitle className="font-serif text-lg text-white flex items-center gap-2">
                    <Info className="h-5 w-5 text-teal-500" />
                    What Contributed to This Score
                  </CardTitle>
                  <p className="text-zinc-500 text-sm mt-1">
                    These factors were identified based on the figures provided. Higher-weight items may attract more attention.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(simResult ? simTriggered : triggeredIndicators).length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <CheckCircle className="h-10 w-10 text-emerald-500/70 mx-auto mb-4" />
                      <p className="text-zinc-400 text-sm">No predefined risk signals were triggered based on the figures provided.</p>
                      <p className="text-zinc-600 text-xs mt-2">This does not guarantee exemption from review.</p>
                    </div>
                  ) : (
                    (simResult ? simTriggered : triggeredIndicators).map((indicator, idx) => {
                      const weightStyle = getWeightLabel(indicator.weight);
                      return (
                        <div key={idx} className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <span className="font-medium text-white text-sm">{indicator.name}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge className={`${weightStyle.color} border text-xs px-2 py-0.5`}>
                                {weightStyle.text}
                              </Badge>
                              <span className="text-zinc-500 text-xs">+{indicator.points} pts</span>
                            </div>
                          </div>
                          <p className="text-zinc-400 text-sm leading-relaxed mb-3">{indicator.explanation}</p>
                          <div className="space-y-2 text-xs">
                            <div className="flex gap-2">
                              <span className="text-teal-500 flex-shrink-0">Why it matters:</span>
                              <span className="text-zinc-500">{indicator.hmrc_context}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="text-teal-500 flex-shrink-0">Record-keeping:</span>
                              <span className="text-zinc-500">{indicator.documentation_tips}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Contextual Notes */}
                  {assessment.contextual_notes && assessment.contextual_notes.length > 0 && (
                    <div className="mt-4 p-3 bg-zinc-800/20 rounded-lg border border-zinc-800/30">
                      <p className="text-zinc-600 text-xs font-medium mb-2">Additional Context:</p>
                      {assessment.contextual_notes.map((note, idx) => (
                        <p key={idx} className="text-zinc-500 text-xs leading-relaxed">{note}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              
              {/* Summary Card */}
              <Card className="border border-zinc-800/60 bg-zinc-900/40">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base text-white">Assessment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/40">
                    <span className="text-zinc-500">Tax Year</span>
                    <span className="text-zinc-300">{assessment.tax_year}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/40">
                    <span className="text-zinc-500">Turnover</span>
                    <span className="text-zinc-300">£{assessment.turnover?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/40">
                    <span className="text-zinc-500">Expenses</span>
                    <span className="text-zinc-300">£{assessment.total_expenses?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/40">
                    <span className="text-zinc-500">Profit/Loss</span>
                    <span className={assessment.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {assessment.profit >= 0 ? '' : '-'}£{Math.abs(assessment.profit)?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/40">
                    <span className="text-zinc-500">Mileage</span>
                    <span className="text-zinc-300">{(assessment.mileage_miles || assessment.mileage_claimed || 0).toLocaleString()} miles</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-zinc-500">Signals Triggered</span>
                    <span className="text-zinc-300">{triggeredIndicators.length}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Simulation Tool */}
              <Card className="border border-zinc-800/60 bg-zinc-900/40">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-serif text-base text-white flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-amber-500" />
                      What-If Analysis
                    </CardTitle>
                    <Switch checked={showSimulation} onCheckedChange={setShowSimulation} />
                  </div>
                  {!showSimulation && (
                    <p className="text-zinc-600 text-xs mt-1">Toggle to explore how changes may affect your score.</p>
                  )}
                </CardHeader>
                {showSimulation && (
                  <CardContent className="space-y-5">
                    <p className="text-zinc-500 text-xs">Adjust values to see potential impact. No changes are saved.</p>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <Label className="text-xs text-zinc-400">Total Expenses</Label>
                          <span className="text-xs text-zinc-500">£{simData.total_expenses?.toLocaleString()}</span>
                        </div>
                        <Slider
                          value={[simData.total_expenses]}
                          onValueChange={([v]) => setSimData(prev => ({ ...prev, total_expenses: v }))}
                          min={0}
                          max={Math.max(assessment.turnover, assessment.total_expenses * 1.5)}
                          step={1000}
                          className="cursor-pointer"
                        />
                        <p className="text-zinc-600 text-xs mt-1">Reducing expenses may lower risk signals.</p>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-2">
                          <Label className="text-xs text-zinc-400">Motor Costs</Label>
                          <span className="text-xs text-zinc-500">£{simData.motor_costs?.toLocaleString()}</span>
                        </div>
                        <Slider
                          value={[simData.motor_costs]}
                          onValueChange={([v]) => setSimData(prev => ({ ...prev, motor_costs: v }))}
                          min={0}
                          max={Math.max(assessment.turnover * 0.5, assessment.motor_costs * 2)}
                          step={500}
                          className="cursor-pointer"
                        />
                        <p className="text-zinc-600 text-xs mt-1">High motor costs relative to turnover may attract review.</p>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-2">
                          <Label className="text-xs text-zinc-400">Business Mileage</Label>
                          <span className="text-xs text-zinc-500">{simData.mileage_claimed?.toLocaleString()} miles</span>
                        </div>
                        <Slider
                          value={[simData.mileage_claimed]}
                          onValueChange={([v]) => setSimData(prev => ({ ...prev, mileage_claimed: v }))}
                          min={0}
                          max={50000}
                          step={500}
                          className="cursor-pointer"
                        />
                        <p className="text-zinc-600 text-xs mt-1">Large mileage claims benefit from detailed records.</p>
                      </div>
                      
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <Label className="text-xs text-zinc-400">Declare Loss</Label>
                          <p className="text-zinc-600 text-xs mt-0.5">Losses may increase scrutiny likelihood.</p>
                        </div>
                        <Switch
                          checked={simData.loss_this_year}
                          onCheckedChange={(v) => setSimData(prev => ({ ...prev, loss_this_year: v }))}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        onClick={runSimulation} 
                        disabled={simulating} 
                        className="flex-1 bg-amber-600 hover:bg-amber-500 text-sm h-9"
                      >
                        {simulating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run Analysis'}
                      </Button>
                      <Button 
                        onClick={resetSimulation} 
                        variant="outline" 
                        className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm h-9 px-3"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Purchase/Download Card */}
              {assessment.payment_status === 'paid' ? (
                <Card className="border border-emerald-800/40 bg-emerald-950/20">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-900/50 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <span className="font-medium text-white block">Report Available</span>
                        <span className="text-emerald-500/70 text-xs">Full analysis ready</span>
                      </div>
                    </div>
                    <Button onClick={handleDownload} className="w-full bg-emerald-600 hover:bg-emerald-500" data-testid="download-report-btn">
                      <FileText className="mr-2 h-4 w-4" />Download PDF Report
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-teal-800/40 bg-teal-950/20">
                  <CardContent className="p-5">
                    <h3 className="font-medium text-white mb-2">Full Report</h3>
                    <p className="text-zinc-500 text-xs mb-4 leading-relaxed">
                      Detailed analysis with industry comparison, documentation guidance, and record-keeping checklist.
                    </p>
                    <div className="text-2xl font-bold text-teal-400 mb-4">£{assessment.payment_amount || 29.99}</div>
                    <Button 
                      onClick={handlePurchase} 
                      disabled={checkoutLoading || isPreview} 
                      className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50" 
                      data-testid="purchase-report-btn"
                    >
                      {checkoutLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Lock className="mr-2 h-4 w-4" />
                      )}
                      {isPreview ? 'Payment Disabled (Preview)' : 'Get Full Report'}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Footer Disclaimer */}
          <div className="mt-10 pt-6 border-t border-zinc-800/40">
            <p className="text-zinc-600 text-xs text-center max-w-2xl mx-auto leading-relaxed">
              This tool provides automated risk indicators based on user-entered figures and statistical patterns. 
              It does not provide tax advice, does not guarantee outcomes, and does not submit or amend tax returns. 
              Consult a qualified professional for specific guidance.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ResultsPage;
