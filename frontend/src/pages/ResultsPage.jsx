import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Shield, ArrowLeft, FileText, Lock, CheckCircle, AlertTriangle, Loader2, Building2, Info, SlidersHorizontal, RotateCcw } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ResultsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  // Simulation state
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

  const getRiskColor = (band) => {
    switch (band) {
      case 'LOW': return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/50', glow: 'shadow-emerald-500/20' };
      case 'MODERATE': return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/50', glow: 'shadow-amber-500/20' };
      case 'HIGH': return { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/50', glow: 'shadow-rose-500/20' };
      default: return { bg: 'bg-zinc-500/20', text: 'text-zinc-400', border: 'border-zinc-500/50', glow: '' };
    }
  };

  const getWeightColor = (weight) => {
    switch (weight) {
      case 'high': return 'text-rose-400 bg-rose-500/10';
      case 'medium': return 'text-amber-400 bg-amber-500/10';
      case 'low': return 'text-emerald-400 bg-emerald-500/10';
      default: return 'text-zinc-400 bg-zinc-500/10';
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
        <Button onClick={() => navigate('/')} className="bg-teal-600 hover:bg-teal-500">Go Home</Button>
      </div>
    );
  }

  const riskColors = getRiskColor(assessment.risk_band);
  const triggeredIndicators = (assessment.risk_indicators || []).filter(i => i.triggered);
  const displayScore = simResult ? simResult.simulated_score : assessment.risk_score;
  const displayBand = simResult ? simResult.simulated_band : assessment.risk_band;
  const displayColors = getRiskColor(displayBand);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="bg-[#0d0d14] border-b border-zinc-800 px-6 md:px-12 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors" data-testid="back-home-btn">
            <ArrowLeft className="h-5 w-5" /><span>Home</span>
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-500" />
            <span className="font-serif font-semibold text-white">HMRC Risk Engine PRO</span>
          </div>
        </div>
      </header>

      <main className="px-6 md:px-12 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Score Card */}
            <div className="lg:col-span-2 space-y-6">
              {/* Score Display */}
              <Card className="card-dark border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <div className={`h-1 ${displayColors.bg}`}></div>
                <CardContent className="p-8 text-center">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Building2 className="h-5 w-5 text-teal-500" />
                    <span className="text-zinc-400">{assessment.industry_name || 'General'}</span>
                  </div>
                  
                  <p className="text-zinc-500 mb-4">{simResult ? 'Simulated' : 'Your'} HMRC Risk Score</p>
                  
                  <div className={`inline-flex items-center justify-center w-40 h-40 rounded-full ${displayColors.bg} ${displayColors.border} border-4 shadow-lg ${displayColors.glow} mb-6`}>
                    <div className="text-center">
                      <span className={`text-5xl font-bold ${displayColors.text}`} data-testid="risk-score">{displayScore}</span>
                      <span className={`text-2xl ${displayColors.text}`}>/100</span>
                    </div>
                  </div>

                  <Badge className={`${displayColors.bg} ${displayColors.text} ${displayColors.border} border text-lg px-6 py-2`} data-testid="risk-band">
                    {displayBand} RISK
                  </Badge>

                  {simResult && (
                    <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
                      <span className={`text-sm ${simResult.score_change > 0 ? 'text-rose-400' : simResult.score_change < 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                        {simResult.score_change > 0 ? '+' : ''}{simResult.score_change} points from original
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Risk Transparency Panel */}
              <Card className="card-dark border-zinc-800 bg-zinc-900/50">
                <CardHeader>
                  <CardTitle className="font-serif text-lg text-white flex items-center gap-2">
                    <Info className="h-5 w-5 text-teal-500" />
                    What Affected Your Score
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {triggeredIndicators.length === 0 ? (
                    <div className="text-center py-6">
                      <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                      <p className="text-zinc-400">No predefined risk indicators were triggered based on the figures provided and the current rule set.</p>
                    </div>
                  ) : (
                    triggeredIndicators.map((indicator, idx) => (
                      <div key={idx} className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-semibold text-white">{indicator.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge className={`${getWeightColor(indicator.weight)} text-xs`}>{indicator.weight}</Badge>
                            <Badge className="bg-zinc-700 text-zinc-300 text-xs">+{indicator.points}</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-zinc-400 mb-2">{indicator.explanation}</p>
                        <div className="text-xs text-zinc-500 space-y-1">
                          <p><span className="text-teal-500">HMRC Context:</span> {indicator.hmrc_context}</p>
                          <p><span className="text-teal-500">Documentation:</span> {indicator.documentation_tips}</p>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Contextual Notes */}
                  {assessment.contextual_notes && assessment.contextual_notes.length > 0 && (
                    <div className="mt-4 p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/30">
                      <p className="text-xs text-zinc-500 font-medium mb-2">Contextual Notes:</p>
                      {assessment.contextual_notes.map((note, idx) => (
                        <p key={idx} className="text-xs text-zinc-500">{note}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Summary Card */}
              <Card className="card-dark border-zinc-800 bg-zinc-900/50">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base text-white">Assessment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-500">Tax Year</span><span className="text-white">{assessment.tax_year}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Turnover</span><span className="text-white">£{assessment.turnover?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Expenses</span><span className="text-white">£{assessment.total_expenses?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Profit</span><span className={assessment.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>£{assessment.profit?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Mileage</span><span className="text-white">{assessment.mileage_miles?.toLocaleString() || 0} miles</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Indicators</span><span className="text-white">{triggeredIndicators.length} triggered</span></div>
                </CardContent>
              </Card>

              {/* Simulation Tool */}
              <Card className="card-dark border-zinc-800 bg-zinc-900/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-serif text-base text-white flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-amber-500" />
                      Risk Simulator
                    </CardTitle>
                    <Switch checked={showSimulation} onCheckedChange={setShowSimulation} />
                  </div>
                </CardHeader>
                {showSimulation && (
                  <CardContent className="space-y-4">
                    <p className="text-xs text-zinc-500">Adjust values to see how they affect your score. Changes are not saved.</p>
                    
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-zinc-400">Total Expenses: £{simData.total_expenses?.toLocaleString()}</Label>
                        <Slider
                          value={[simData.total_expenses]}
                          onValueChange={([v]) => setSimData(prev => ({ ...prev, total_expenses: v }))}
                          max={assessment.turnover}
                          step={1000}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-400">Motor Costs: £{simData.motor_costs?.toLocaleString()}</Label>
                        <Slider
                          value={[simData.motor_costs]}
                          onValueChange={([v]) => setSimData(prev => ({ ...prev, motor_costs: v }))}
                          max={assessment.turnover * 0.5}
                          step={500}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-400">Mileage: {simData.mileage_claimed?.toLocaleString()} miles</Label>
                        <Slider
                          value={[simData.mileage_claimed]}
                          onValueChange={([v]) => setSimData(prev => ({ ...prev, mileage_claimed: v }))}
                          max={50000}
                          step={500}
                          className="mt-2"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-zinc-400">Declare Loss</Label>
                        <Switch
                          checked={simData.loss_this_year}
                          onCheckedChange={(v) => setSimData(prev => ({ ...prev, loss_this_year: v }))}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={runSimulation} disabled={simulating} className="flex-1 bg-amber-600 hover:bg-amber-500 text-sm">
                        {simulating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simulate'}
                      </Button>
                      <Button onClick={resetSimulation} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white text-sm">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Purchase/Download */}
              {assessment.payment_status === 'paid' ? (
                <Card className="card-dark border-zinc-800 border-l-4 border-l-emerald-500 bg-zinc-900/50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <CheckCircle className="h-6 w-6 text-emerald-400" />
                      <span className="font-semibold text-white">Report Ready</span>
                    </div>
                    <Button onClick={handleDownload} className="w-full bg-emerald-600 hover:bg-emerald-500" data-testid="download-report-btn">
                      <FileText className="mr-2 h-5 w-5" />Download PDF
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="card-dark border-zinc-800 border-l-4 border-l-teal-500 bg-zinc-900/50">
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-white mb-2">Unlock Full Report</h3>
                    <p className="text-xs text-zinc-500 mb-4">Get detailed analysis, industry comparison, and documentation checklist.</p>
                    <div className="text-2xl font-bold text-teal-400 mb-4">£{assessment.payment_amount || 29.99}</div>
                    <Button onClick={handlePurchase} disabled={checkoutLoading} className="w-full bg-teal-600 hover:bg-teal-500" data-testid="purchase-report-btn">
                      {checkoutLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Lock className="mr-2 h-5 w-5" />}
                      Get Full Report
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-zinc-600 text-center mt-8 max-w-lg mx-auto">
            This tool provides automated risk indicators based on user-entered figures. It does not provide tax advice and does not submit or amend tax returns.
          </p>
        </div>
      </main>
    </div>
  );
};

export default ResultsPage;
