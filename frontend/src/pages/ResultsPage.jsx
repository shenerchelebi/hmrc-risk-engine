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
import { Input } from "@/components/ui/input";
import { Shield, ArrowLeft, FileText, Lock, CheckCircle, AlertTriangle, Loader2, Building2, Info, SlidersHorizontal, RotateCcw, TrendingUp, TrendingDown, Minus, Eye, AlertCircle, Lightbulb } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Industry benchmark ranges (indicative only)
const INDUSTRY_BENCHMARKS = {
  expense_ratio: { low: [0, 40], typical: [40, 65], elevated: [65, 100] },
  motor_ratio: { low: [0, 15], typical: [15, 35], elevated: [35, 100] },
  profit_margin: { low: [0, 10], typical: [10, 30], elevated: [30, 100] }
};

const ResultsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Preview mode - STRICT CONTROLS
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
    if (isPreview) {
      toast.error("Payment disabled in preview mode");
      return;
    }
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
    if (isPreview) {
      toast.error("PDF download disabled in preview mode");
      return;
    }
    window.open(`${API}/report/download/${id}`, '_blank');
  };

  const getRiskStyles = (band) => {
    switch (band) {
      case 'LOW': 
        return { bg: 'bg-emerald-900/30', text: 'text-emerald-400', border: 'border-emerald-600/40', accent: 'emerald', label: 'Low Risk Signal' };
      case 'MODERATE': 
        return { bg: 'bg-amber-900/30', text: 'text-amber-400', border: 'border-amber-600/40', accent: 'amber', label: 'Moderate Risk Signal' };
      case 'HIGH': 
        return { bg: 'bg-rose-900/30', text: 'text-rose-400', border: 'border-rose-600/40', accent: 'rose', label: 'Elevated Risk Signal' };
      default: 
        return { bg: 'bg-zinc-800/50', text: 'text-zinc-400', border: 'border-zinc-700', accent: 'zinc', label: 'Risk Signal' };
    }
  };

  const getWeightStyle = (weight) => {
    switch (weight) {
      case 'high': return { text: 'High', bg: 'bg-rose-500/20', textColor: 'text-rose-400', border: 'border-rose-500/30' };
      case 'medium': return { text: 'Medium', bg: 'bg-amber-500/20', textColor: 'text-amber-400', border: 'border-amber-500/30' };
      case 'low': return { text: 'Low', bg: 'bg-emerald-500/20', textColor: 'text-emerald-400', border: 'border-emerald-500/30' };
      default: return { text: 'Standard', bg: 'bg-zinc-500/20', textColor: 'text-zinc-400', border: 'border-zinc-500/30' };
    }
  };

  // Get benchmark band for a value
  const getBenchmarkBand = (value, metric) => {
    const ranges = INDUSTRY_BENCHMARKS[metric];
    if (!ranges) return 'typical';
    if (value >= ranges.low[0] && value < ranges.low[1]) return 'low';
    if (value >= ranges.typical[0] && value < ranges.typical[1]) return 'typical';
    return 'elevated';
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
  
  // Get top 3 drivers sorted by points (descending)
  const topDrivers = [...triggeredIndicators].sort((a, b) => b.points - a.points).slice(0, 3);
  
  // Contextual notes (informational, not risk signals)
  const contextualNotes = assessment.contextual_notes || [];

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative">
      {/* Preview Mode Watermark */}
      {isPreview && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
          <div className="absolute transform rotate-[-30deg] text-amber-500/10 text-[120px] font-bold whitespace-nowrap select-none">
            PREVIEW ONLY
          </div>
        </div>
      )}
      
      {/* Preview Mode Banner */}
      {isPreview && (
        <div className="sticky top-0 z-40 bg-amber-900/90 border-b border-amber-600 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-center gap-3">
            <Eye className="h-5 w-5 text-amber-300" />
            <span className="text-amber-100 font-semibold">PREVIEW MODE</span>
            <span className="text-amber-300 text-sm">– Payment & PDF Download Disabled – For UI Testing Only</span>
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

      <main className="px-6 md:px-12 py-8">
        <div className="max-w-5xl mx-auto">
          
          {/* ========== HERO SECTION: Above the fold ========== */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            
            {/* Left: Score Hero + Top Drivers */}
            <div className="lg:col-span-2">
              <Card className={`border-2 ${displayStyles.border} ${displayStyles.bg} overflow-hidden`}>
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-center gap-6">
                    
                    {/* Score Circle - HERO */}
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <div className={`w-36 h-36 md:w-44 md:h-44 rounded-full ${displayStyles.bg} ${displayStyles.border} border-2 flex items-center justify-center`}>
                          <div className="text-center">
                            <div className={`text-5xl md:text-6xl font-bold tracking-tight ${displayStyles.text}`} data-testid="risk-score">
                              {displayScore}
                            </div>
                            <div className="text-zinc-500 text-xs mt-1">out of 100</div>
                          </div>
                        </div>
                        {simResult && (
                          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${
                            simResult.score_change > 0 ? 'bg-rose-950/80 text-rose-400 border border-rose-800/50' 
                            : simResult.score_change < 0 ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}>
                            {simResult.score_change > 0 ? <TrendingUp className="h-3 w-3" /> : simResult.score_change < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            {simResult.score_change > 0 ? '+' : ''}{simResult.score_change}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Score Info + Top Drivers */}
                    <div className="flex-1 min-w-0">
                      {/* Industry + Band */}
                      <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
                        <Building2 className="h-4 w-4" />
                        <span>{assessment.industry_name || 'General'}</span>
                      </div>
                      
                      <Badge className={`${displayStyles.bg} ${displayStyles.text} ${displayStyles.border} border text-base px-4 py-1 font-medium mb-3`} data-testid="risk-band">
                        {displayStyles.label}
                      </Badge>
                      
                      {/* 1-line meaning */}
                      <p className="text-zinc-400 text-sm mb-4">
                        {displayBand === 'LOW' && "Your figures fall within typical ranges for this sector."}
                        {displayBand === 'MODERATE' && "Some figures may warrant attention. Detailed records advisable."}
                        {displayBand === 'HIGH' && "Several indicators may attract review. Professional advice recommended."}
                      </p>
                      
                      {/* Top Drivers (up to 3) */}
                      {topDrivers.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-zinc-600 text-xs font-medium uppercase tracking-wide">Top contributing factors:</p>
                          {topDrivers.map((driver, idx) => {
                            const ws = getWeightStyle(driver.weight);
                            return (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <AlertCircle className={`h-3.5 w-3.5 flex-shrink-0 ${ws.textColor}`} />
                                <span className="text-zinc-300 truncate">{driver.name}</span>
                                <Badge className={`${ws.bg} ${ws.textColor} ${ws.border} border text-[10px] px-1.5 py-0`}>
                                  {ws.text}
                                </Badge>
                                <span className="text-zinc-600 text-xs">+{driver.points}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {topDrivers.length === 0 && (
                        <div className="flex items-center gap-2 text-sm text-emerald-400/80">
                          <CheckCircle className="h-4 w-4" />
                          <span>No predefined risk signals triggered</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Right: Primary CTA (Paywall) */}
            <div>
              {assessment.payment_status === 'paid' ? (
                <Card className="border border-emerald-800/40 bg-emerald-950/20 h-full">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-900/50 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <span className="font-medium text-white block">Report Ready</span>
                        <span className="text-emerald-500/70 text-xs">Full analysis available</span>
                      </div>
                    </div>
                    <div className="flex-1" />
                    <Button onClick={handleDownload} className="w-full bg-emerald-600 hover:bg-emerald-500" data-testid="download-report-btn">
                      <FileText className="mr-2 h-4 w-4" />Download PDF
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-teal-800/40 bg-teal-950/20 h-full">
                  <CardContent className="p-5 flex flex-col h-full">
                    <h3 className="font-medium text-white mb-3">Full Report</h3>
                    
                    {/* 3-bullet value stack */}
                    <ul className="space-y-2 mb-4 text-xs">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-teal-500 mt-0.5 flex-shrink-0" />
                        <span className="text-zinc-400">Industry-specific comparison & benchmarks</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-teal-500 mt-0.5 flex-shrink-0" />
                        <span className="text-zinc-400">Documentation checklist for each indicator</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-teal-500 mt-0.5 flex-shrink-0" />
                        <span className="text-zinc-400">AI-generated guidance tailored to your figures</span>
                      </li>
                    </ul>
                    
                    <div className="flex-1" />
                    <div className="text-2xl font-bold text-teal-400 mb-3">£{assessment.payment_amount || 29.99}</div>
                    <Button 
                      onClick={handlePurchase} 
                      disabled={checkoutLoading || isPreview} 
                      className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50" 
                      data-testid="purchase-report-btn"
                    >
                      {checkoutLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                      {isPreview ? 'Payment Disabled (Preview)' : 'Get Full Report'}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          
          {/* ========== BELOW THE FOLD ========== */}
          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Left Column: Details */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Indicative Sector Benchmarks */}
              <Card className="border border-zinc-800/60 bg-zinc-900/40">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base text-white flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-teal-500" />
                    Indicative Sector Ranges
                  </CardTitle>
                  <p className="text-zinc-600 text-xs mt-1">Indicative ranges, not HMRC thresholds. For reference only.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Expense Ratio Benchmark */}
                  <BenchmarkBar 
                    label="Expense Ratio"
                    value={assessment.expense_ratio}
                    unit="%"
                    ranges={INDUSTRY_BENCHMARKS.expense_ratio}
                  />
                  
                  {/* Profit Margin Benchmark */}
                  <BenchmarkBar 
                    label="Profit Margin"
                    value={assessment.profit_ratio}
                    unit="%"
                    ranges={INDUSTRY_BENCHMARKS.profit_margin}
                  />
                  
                  {/* Motor Ratio Benchmark (only if motor costs exist) */}
                  {assessment.motor_costs > 0 && (
                    <BenchmarkBar 
                      label="Motor Costs"
                      value={assessment.motor_ratio}
                      unit="%"
                      ranges={INDUSTRY_BENCHMARKS.motor_ratio}
                    />
                  )}
                </CardContent>
              </Card>
              
              {/* Risk Signals Panel */}
              <Card className="border border-zinc-800/60 bg-zinc-900/40">
                <CardHeader className="pb-4">
                  <CardTitle className="font-serif text-lg text-white flex items-center gap-2">
                    <Info className="h-5 w-5 text-teal-500" />
                    What Contributed to This Score
                  </CardTitle>
                  <p className="text-zinc-500 text-sm mt-1">
                    Factors identified based on your figures. Higher-weight items may attract more attention.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(simResult ? simTriggered : triggeredIndicators).length === 0 && contextualNotes.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <CheckCircle className="h-10 w-10 text-emerald-500/70 mx-auto mb-4" />
                      <p className="text-zinc-400 text-sm">No predefined risk signals were triggered.</p>
                      <p className="text-zinc-600 text-xs mt-2">This does not guarantee exemption from review.</p>
                    </div>
                  ) : (
                    <>
                      {/* Risk Signal Cards */}
                      {(simResult ? simTriggered : triggeredIndicators).map((indicator, idx) => {
                        const ws = getWeightStyle(indicator.weight);
                        return (
                          <div key={idx} className="p-4 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 border text-[10px] px-1.5 py-0">
                                  Risk Signal
                                </Badge>
                                <span className="font-medium text-white text-sm">{indicator.name}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge className={`${ws.bg} ${ws.textColor} ${ws.border} border text-xs px-2 py-0.5 font-medium`}>
                                  {ws.text} Weight
                                </Badge>
                                <span className="text-zinc-400 text-sm font-semibold">+{indicator.points}</span>
                              </div>
                            </div>
                            <p className="text-zinc-400 text-sm leading-relaxed mb-3">{indicator.explanation}</p>
                            <div className="grid md:grid-cols-2 gap-3 text-xs">
                              <div className="p-2 rounded bg-zinc-900/50">
                                <span className="text-teal-500 font-medium block mb-1">Why it matters:</span>
                                <span className="text-zinc-500">{indicator.hmrc_context}</span>
                              </div>
                              <div className="p-2 rounded bg-zinc-900/50">
                                <span className="text-teal-500 font-medium block mb-1">Record-keeping:</span>
                                <span className="text-zinc-500">{indicator.documentation_tips}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Contextual Notes (informational, not risk) */}
                      {contextualNotes.length > 0 && (
                        <>
                          {contextualNotes.map((note, idx) => (
                            <div key={`note-${idx}`} className="p-4 rounded-lg bg-blue-950/20 border border-blue-800/30">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-0.5">
                                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 border text-[10px] px-1.5 py-0">
                                    Context Note
                                  </Badge>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Lightbulb className="h-4 w-4 text-blue-400" />
                                    <span className="text-blue-300 text-sm font-medium">Additional Context</span>
                                  </div>
                                  <p className="text-zinc-400 text-sm leading-relaxed">{note}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Right Column: Summary + Simulation */}
            <div className="space-y-6">
              
              {/* Assessment Summary */}
              <Card className="border border-zinc-800/60 bg-zinc-900/40">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base text-white">Assessment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <SummaryRow label="Tax Year" value={assessment.tax_year} />
                  <SummaryRow label="Turnover" value={`£${assessment.turnover?.toLocaleString()}`} />
                  <SummaryRow label="Expenses" value={`£${assessment.total_expenses?.toLocaleString()}`} />
                  <SummaryRow 
                    label="Profit/Loss" 
                    value={`${assessment.profit >= 0 ? '' : '-'}£${Math.abs(assessment.profit)?.toLocaleString()}`}
                    valueClass={assessment.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                  />
                  <SummaryRow label="Mileage" value={`${(assessment.mileage_miles || assessment.mileage_claimed || 0).toLocaleString()} miles`} />
                  <SummaryRow label="Signals Triggered" value={triggeredIndicators.length} border={false} />
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
                    {/* No changes saved notice */}
                    <div className="flex items-center gap-2 p-2 rounded bg-amber-950/20 border border-amber-800/30">
                      <Info className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                      <p className="text-amber-400/80 text-xs">No changes are saved. This is for exploration only.</p>
                    </div>
                    
                    <div className="space-y-5">
                      {/* Total Expenses */}
                      <SimulationField
                        label="Total Expenses"
                        value={simData.total_expenses}
                        onChange={(v) => setSimData(prev => ({ ...prev, total_expenses: v }))}
                        min={0}
                        max={Math.max(assessment.turnover, assessment.total_expenses * 1.5)}
                        step={1000}
                        unit="£"
                        hint="Reducing expenses may lower risk signals."
                      />
                      
                      {/* Motor Costs */}
                      <SimulationField
                        label="Motor Costs"
                        value={simData.motor_costs}
                        onChange={(v) => setSimData(prev => ({ ...prev, motor_costs: v }))}
                        min={0}
                        max={Math.max(assessment.turnover * 0.5, assessment.motor_costs * 2)}
                        step={500}
                        unit="£"
                        hint="High motor costs relative to turnover may attract review."
                      />
                      
                      {/* Business Mileage */}
                      <SimulationField
                        label="Business Mileage"
                        value={simData.mileage_claimed}
                        onChange={(v) => setSimData(prev => ({ ...prev, mileage_claimed: v }))}
                        min={0}
                        max={50000}
                        step={500}
                        unit="miles"
                        hint="Large mileage claims benefit from detailed records."
                      />
                      
                      {/* Loss Toggle */}
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

                    {/* Run + Reset buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button onClick={runSimulation} disabled={simulating} className="flex-1 bg-amber-600 hover:bg-amber-500 text-sm h-9">
                        {simulating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Run Analysis
                      </Button>
                      <Button onClick={resetSimulation} variant="ghost" className="text-zinc-400 hover:text-white text-sm h-9 px-4">
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                    </div>
                    
                    {/* Simulation Result */}
                    {simResult && (
                      <div className="pt-3 border-t border-zinc-800/50">
                        <div className="flex justify-between text-sm">
                          <div className="text-center">
                            <div className="text-zinc-500 text-xs mb-1">Original</div>
                            <div className={`font-semibold ${originalStyles.text}`}>{assessment.risk_score} ({assessment.risk_band})</div>
                          </div>
                          <div className="text-center">
                            <div className="text-zinc-500 text-xs mb-1">Simulated</div>
                            <div className={`font-semibold ${displayStyles.text}`}>{simResult.simulated_score} ({simResult.simulated_band})</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
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

// ========== HELPER COMPONENTS ==========

// Summary Row Component
const SummaryRow = ({ label, value, valueClass = 'text-zinc-300', border = true }) => (
  <div className={`flex justify-between py-1.5 ${border ? 'border-b border-zinc-800/40' : ''}`}>
    <span className="text-zinc-500">{label}</span>
    <span className={valueClass}>{value}</span>
  </div>
);

// Simulation Field with Slider + Input
const SimulationField = ({ label, value, onChange, min, max, step, unit, hint }) => {
  const isMonetary = unit === '£';
  const displayValue = isMonetary ? `£${value?.toLocaleString()}` : `${value?.toLocaleString()} ${unit}`;
  
  const handleInputChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10) || 0;
    onChange(Math.min(Math.max(num, min), max));
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <Label className="text-xs text-zinc-400">{label} ({unit})</Label>
        <Input
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          className="w-28 h-7 text-xs text-right bg-zinc-800/50 border-zinc-700 text-zinc-300"
        />
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="cursor-pointer"
      />
      <p className="text-zinc-600 text-xs mt-1">{hint}</p>
    </div>
  );
};

// Benchmark Bar Component
const BenchmarkBar = ({ label, value, unit, ranges }) => {
  // Determine which band the value falls into
  let band = 'typical';
  let position = 50; // default middle
  
  if (value < ranges.low[1]) {
    band = 'low';
    position = (value / ranges.low[1]) * 33;
  } else if (value < ranges.typical[1]) {
    band = 'typical';
    position = 33 + ((value - ranges.typical[0]) / (ranges.typical[1] - ranges.typical[0])) * 34;
  } else {
    band = 'elevated';
    position = 67 + Math.min(((value - ranges.elevated[0]) / 35) * 33, 33);
  }
  
  position = Math.max(2, Math.min(98, position)); // clamp to 2-98%
  
  const bandColors = {
    low: 'text-emerald-400',
    typical: 'text-amber-400',
    elevated: 'text-rose-400'
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-zinc-400 text-xs">{label}</span>
        <span className={`text-xs font-medium ${bandColors[band]}`}>{value?.toFixed(1)}{unit}</span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden bg-zinc-800">
        {/* Bands */}
        <div className="absolute inset-0 flex">
          <div className="w-1/3 bg-emerald-900/50" />
          <div className="w-1/3 bg-amber-900/50" />
          <div className="w-1/3 bg-rose-900/50" />
        </div>
        {/* Position marker */}
        <div 
          className="absolute top-0 h-full w-1 bg-white rounded-full shadow-lg transition-all duration-300"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-zinc-600">
        <span>Low</span>
        <span>Typical</span>
        <span>Elevated</span>
      </div>
    </div>
  );
};

export default ResultsPage;
