import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Shield, ArrowLeft, HelpCircle, Loader2, AlertTriangle, ChevronDown, ChevronUp, Building2, Briefcase, PoundSterling, Globe } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const INDUSTRIES = [
  { id: "phv_taxi", name: "PHV / Taxi / Uber", icon: "🚗" },
  { id: "construction_cis", name: "Construction / CIS", icon: "🏗️" },
  { id: "cleaning", name: "Cleaning Services", icon: "🧹" },
  { id: "retail", name: "Retail", icon: "🏪" },
  { id: "consultant_it", name: "Consultant / IT", icon: "💻" },
  { id: "other", name: "Other / General", icon: "📋" }
];

const AssessmentPage = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedIncome, setExpandedIncome] = useState(false);
  const [expandedCapital, setExpandedCapital] = useState(false);
  const [expandedLoss, setExpandedLoss] = useState(false);
  
  const [formData, setFormData] = useState({
    tax_year: "2023-24",
    industry: "other",
    turnover: "",
    total_expenses: "",
    motor_costs: "",
    mileage_claimed: "",
    method: "actual",
    home_office_amount: "",
    phone_internet: "",
    travel_subsistence: "",
    marketing: "",
    loss_this_year: false,
    loss_last_year: false,
    email: "",
    report_type: "v2_pro",
    // V2 fields
    has_other_income: false,
    employment_income: "",
    rental_income: "",
    dividends_income: "",
    interest_income: "",
    has_foreign_income: false,
    foreign_income: "",
    has_capital_allowances: false,
    capital_allowances_amount: "",
    capital_allowances_method: "aia",
    has_loss_carry_forward: false,
    loss_carry_forward_amount: ""
  });

  const calculatedProfit = useMemo(() => {
    const turnover = parseFloat(formData.turnover) || 0;
    const expenses = parseFloat(formData.total_expenses) || 0;
    return turnover - expenses;
  }, [formData.turnover, formData.total_expenses]);

  const hasDataInconsistency = useMemo(() => {
    return formData.loss_this_year && calculatedProfit > 0;
  }, [formData.loss_this_year, calculatedProfit]);

  const canSubmit = useMemo(() => {
    return !hasDataInconsistency && formData.email && formData.turnover;
  }, [hasDataInconsistency, formData.email, formData.turnover]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasDataInconsistency) {
      toast.error("Please resolve the data inconsistency");
      return;
    }
    setIsSubmitting(true);

    try {
      const submitData = {
        ...formData,
        turnover: parseFloat(formData.turnover) || 0,
        total_expenses: parseFloat(formData.total_expenses) || 0,
        motor_costs: parseFloat(formData.motor_costs) || 0,
        mileage_claimed: parseFloat(formData.mileage_claimed) || 0,
        home_office_amount: parseFloat(formData.home_office_amount) || 0,
        phone_internet: parseFloat(formData.phone_internet) || 0,
        travel_subsistence: parseFloat(formData.travel_subsistence) || 0,
        marketing: parseFloat(formData.marketing) || 0,
        employment_income: parseFloat(formData.employment_income) || 0,
        rental_income: parseFloat(formData.rental_income) || 0,
        dividends_income: parseFloat(formData.dividends_income) || 0,
        interest_income: parseFloat(formData.interest_income) || 0,
        foreign_income: parseFloat(formData.foreign_income) || 0,
        capital_allowances_amount: parseFloat(formData.capital_allowances_amount) || 0,
        loss_carry_forward_amount: parseFloat(formData.loss_carry_forward_amount) || 0
      };

      const response = await axios.post(`${API}/assessment/submit`, submitData);
      if (response.data.success) {
        toast.success("Assessment complete!");
        navigate(`/results/${response.data.assessment_id}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const InputField = ({ id, label, tooltip, value, onChange, placeholder, type = "number", required = false }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-sm font-medium text-zinc-300">
          {label} {required && <span className="text-teal-500">*</span>}
        </Label>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-zinc-600 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-200 max-w-xs">
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-teal-500"
        data-testid={`input-${id}`}
      />
    </div>
  );

  const profitDisplay = calculatedProfit >= 0 
    ? `£${calculatedProfit.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `-£${Math.abs(calculatedProfit).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="bg-[#0d0d14] border-b border-zinc-800 px-6 md:px-12 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors" data-testid="back-btn">
            <ArrowLeft className="h-5 w-5" /><span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-500" />
            <span className="font-serif font-semibold text-white">HMRC Risk Engine PRO</span>
          </div>
        </div>
      </header>

      <main className="px-6 md:px-12 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-white mb-2">Risk Assessment V2</h1>
            <p className="text-zinc-500">Industry-aware analysis with full transparency</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Basic Info */}
            <Card className="card-dark border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-4">
                <CardTitle className="font-serif text-lg text-white flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-teal-500" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-zinc-300">Tax Year *</Label>
                    <Select value={formData.tax_year} onValueChange={(v) => handleChange('tax_year', v)}>
                      <SelectTrigger className="h-11 bg-zinc-900 border-zinc-700 text-white" data-testid="select-tax-year">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        <SelectItem value="2023-24">2023-24</SelectItem>
                        <SelectItem value="2022-23">2022-23</SelectItem>
                        <SelectItem value="2021-22">2021-22</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <InputField id="email" label="Email Address" value={formData.email} onChange={(v) => handleChange('email', v)} placeholder="your@email.com" type="email" required />
                </div>

                {/* Industry Selector */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Industry / Trade *
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => handleChange('industry', ind.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          formData.industry === ind.id
                            ? 'border-teal-500 bg-teal-500/10 text-white'
                            : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'
                        }`}
                        data-testid={`industry-${ind.id}`}
                      >
                        <span className="text-lg mr-2">{ind.icon}</span>
                        <span className="text-sm">{ind.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Income & Expenses */}
            <Card className="card-dark border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-4">
                <CardTitle className="font-serif text-lg text-white flex items-center gap-2">
                  <PoundSterling className="h-5 w-5 text-teal-500" />
                  Income & Expenses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <InputField id="turnover" label="Turnover (Annual)" tooltip="Total business income before expenses" value={formData.turnover} onChange={(v) => handleChange('turnover', v)} placeholder="£" required />
                  <InputField id="total_expenses" label="Total Expenses" tooltip="All allowable business expenses" value={formData.total_expenses} onChange={(v) => handleChange('total_expenses', v)} placeholder="£" />
                </div>

                {/* Derived Profit */}
                <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-zinc-400">Calculated Profit/Loss</Label>
                    <span className={`text-lg font-semibold ${calculatedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} data-testid="calculated-profit">
                      {profitDisplay}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Motor & Travel */}
            <Card className="card-dark border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-4">
                <CardTitle className="font-serif text-lg text-white">Motor & Travel Expenses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-zinc-300">Expense Method</Label>
                  <RadioGroup value={formData.method} onValueChange={(v) => handleChange('method', v)} className="flex gap-6">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="actual" id="actual" className="border-zinc-600 text-teal-500" />
                      <Label htmlFor="actual" className="cursor-pointer text-zinc-300">Actual Costs</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="mileage" id="mileage" className="border-zinc-600 text-teal-500" />
                      <Label htmlFor="mileage" className="cursor-pointer text-zinc-300">Mileage (45p/mile)</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="grid md:grid-cols-2 gap-5">
                  <InputField id="motor_costs" label="Motor Costs" tooltip="Fuel, insurance, repairs" value={formData.motor_costs} onChange={(v) => handleChange('motor_costs', v)} placeholder="£" />
                  <InputField id="mileage_claimed" label="Business Miles" tooltip="Total business miles claimed" value={formData.mileage_claimed} onChange={(v) => handleChange('mileage_claimed', v)} placeholder="Miles" />
                </div>
                <InputField id="travel_subsistence" label="Travel & Subsistence" tooltip="Business travel, hotels, meals" value={formData.travel_subsistence} onChange={(v) => handleChange('travel_subsistence', v)} placeholder="£" />
              </CardContent>
            </Card>

            {/* Other Expenses */}
            <Card className="card-dark border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-4">
                <CardTitle className="font-serif text-lg text-white">Other Expenses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <InputField id="home_office_amount" label="Home Office" tooltip="Use of home as office" value={formData.home_office_amount} onChange={(v) => handleChange('home_office_amount', v)} placeholder="£" />
                  <InputField id="phone_internet" label="Phone & Internet" tooltip="Business proportion" value={formData.phone_internet} onChange={(v) => handleChange('phone_internet', v)} placeholder="£" />
                </div>
                <InputField id="marketing" label="Marketing & Advertising" value={formData.marketing} onChange={(v) => handleChange('marketing', v)} placeholder="£" />
              </CardContent>
            </Card>

            {/* V2: Expanded Income (Collapsible) */}
            <Collapsible open={expandedIncome} onOpenChange={setExpandedIncome}>
              <Card className="card-dark border-zinc-800 bg-zinc-900/50">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-zinc-800/30 transition-colors pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-serif text-lg text-white flex items-center gap-2">
                        <Globe className="h-5 w-5 text-amber-500" />
                        Additional Income (Optional)
                      </CardTitle>
                      {expandedIncome ? <ChevronUp className="h-5 w-5 text-zinc-500" /> : <ChevronDown className="h-5 w-5 text-zinc-500" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-5 pt-0">
                    <div className="flex items-center space-x-3 pb-2">
                      <Checkbox id="has_other_income" checked={formData.has_other_income} onCheckedChange={(v) => handleChange('has_other_income', v)} className="border-zinc-600 data-[state=checked]:bg-teal-600" />
                      <Label htmlFor="has_other_income" className="cursor-pointer text-zinc-300">I have other income sources</Label>
                    </div>
                    {formData.has_other_income && (
                      <div className="grid md:grid-cols-2 gap-5 pl-6 border-l-2 border-zinc-700">
                        <InputField id="employment_income" label="Employment Income" value={formData.employment_income} onChange={(v) => handleChange('employment_income', v)} placeholder="£" />
                        <InputField id="rental_income" label="Rental Income" value={formData.rental_income} onChange={(v) => handleChange('rental_income', v)} placeholder="£" />
                        <InputField id="dividends_income" label="Dividends" value={formData.dividends_income} onChange={(v) => handleChange('dividends_income', v)} placeholder="£" />
                        <InputField id="interest_income" label="Interest / Other" value={formData.interest_income} onChange={(v) => handleChange('interest_income', v)} placeholder="£" />
                      </div>
                    )}
                    <div className="flex items-center space-x-3">
                      <Checkbox id="has_foreign_income" checked={formData.has_foreign_income} onCheckedChange={(v) => handleChange('has_foreign_income', v)} className="border-zinc-600 data-[state=checked]:bg-teal-600" />
                      <Label htmlFor="has_foreign_income" className="cursor-pointer text-zinc-300">I have foreign income</Label>
                    </div>
                    {formData.has_foreign_income && (
                      <div className="pl-6 border-l-2 border-zinc-700">
                        <InputField id="foreign_income" label="Foreign Income Amount" value={formData.foreign_income} onChange={(v) => handleChange('foreign_income', v)} placeholder="£" />
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* V2: Capital Allowances (Collapsible) */}
            <Collapsible open={expandedCapital} onOpenChange={setExpandedCapital}>
              <Card className="card-dark border-zinc-800 bg-zinc-900/50">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-zinc-800/30 transition-colors pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-serif text-lg text-white">Capital Allowances (Optional)</CardTitle>
                      {expandedCapital ? <ChevronUp className="h-5 w-5 text-zinc-500" /> : <ChevronDown className="h-5 w-5 text-zinc-500" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-5 pt-0">
                    <div className="flex items-center space-x-3">
                      <Checkbox id="has_capital_allowances" checked={formData.has_capital_allowances} onCheckedChange={(v) => handleChange('has_capital_allowances', v)} className="border-zinc-600 data-[state=checked]:bg-teal-600" />
                      <Label htmlFor="has_capital_allowances" className="cursor-pointer text-zinc-300">I'm claiming capital allowances</Label>
                    </div>
                    {formData.has_capital_allowances && (
                      <div className="grid md:grid-cols-2 gap-5 pl-6 border-l-2 border-zinc-700">
                        <InputField id="capital_allowances_amount" label="Amount Claimed" value={formData.capital_allowances_amount} onChange={(v) => handleChange('capital_allowances_amount', v)} placeholder="£" />
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-zinc-300">Method</Label>
                          <Select value={formData.capital_allowances_method} onValueChange={(v) => handleChange('capital_allowances_method', v)}>
                            <SelectTrigger className="h-11 bg-zinc-900 border-zinc-700 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-700">
                              <SelectItem value="aia">AIA (Annual Investment Allowance)</SelectItem>
                              <SelectItem value="wda">WDA (Writing Down Allowance)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Losses */}
            <Card className="card-dark border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-4">
                <CardTitle className="font-serif text-lg text-white">Losses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasDataInconsistency && (
                  <Alert className="bg-amber-500/10 border-amber-500/50 text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="ml-2">
                      <strong>Data inconsistency:</strong> You selected 'loss', but your figures show a profit. Please untick or correct figures.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex items-center space-x-3">
                  <Checkbox id="loss_this_year" checked={formData.loss_this_year} onCheckedChange={(v) => handleChange('loss_this_year', v)} className={`border-zinc-600 data-[state=checked]:bg-teal-600 ${hasDataInconsistency ? 'border-amber-500' : ''}`} data-testid="checkbox-loss-this-year" />
                  <Label htmlFor="loss_this_year" className={`cursor-pointer ${hasDataInconsistency ? 'text-amber-400' : 'text-zinc-300'}`}>I'm declaring a loss this tax year</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox id="loss_last_year" checked={formData.loss_last_year} onCheckedChange={(v) => handleChange('loss_last_year', v)} className="border-zinc-600 data-[state=checked]:bg-teal-600" />
                  <Label htmlFor="loss_last_year" className="cursor-pointer text-zinc-300">I also declared a loss last tax year</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox id="has_loss_carry_forward" checked={formData.has_loss_carry_forward} onCheckedChange={(v) => handleChange('has_loss_carry_forward', v)} className="border-zinc-600 data-[state=checked]:bg-teal-600" />
                  <Label htmlFor="has_loss_carry_forward" className="cursor-pointer text-zinc-300">I'm claiming loss carry-forward</Label>
                </div>
                {formData.has_loss_carry_forward && (
                  <div className="pl-6 border-l-2 border-zinc-700">
                    <InputField id="loss_carry_forward_amount" label="Loss Carry-Forward Amount" value={formData.loss_carry_forward_amount} onChange={(v) => handleChange('loss_carry_forward_amount', v)} placeholder="£" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Report Type Selection */}
            <Card className="card-dark border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-4">
                <CardTitle className="font-serif text-lg text-white">Report Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleChange('report_type', 'v1_basic')}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      formData.report_type === 'v1_basic'
                        ? 'border-teal-500 bg-teal-500/10'
                        : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                    }`}
                  >
                    <div className="font-semibold text-white">Basic Report</div>
                    <div className="text-2xl font-bold text-teal-400 mt-1">£19.99</div>
                    <div className="text-xs text-zinc-500 mt-2">Risk score, band, basic indicators</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('report_type', 'v2_pro')}
                    className={`p-4 rounded-lg border text-left transition-all relative ${
                      formData.report_type === 'v2_pro'
                        ? 'border-teal-500 bg-teal-500/10'
                        : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                    }`}
                  >
                    <div className="absolute -top-2 -right-2 bg-teal-500 text-white text-xs px-2 py-0.5 rounded-full">PRO</div>
                    <div className="font-semibold text-white">PRO Report</div>
                    <div className="text-2xl font-bold text-teal-400 mt-1">£29.99</div>
                    <div className="text-xs text-zinc-500 mt-2">Industry comparison, detailed analysis, documentation tips</div>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex flex-col items-center gap-4 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className={`px-12 py-6 text-lg rounded-xl w-full md:w-auto transition-all ${
                  canSubmit ? 'bg-teal-600 hover:bg-teal-500 text-white' : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                }`}
                data-testid="submit-assessment-btn"
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Analysing...</>
                ) : hasDataInconsistency ? (
                  "Resolve Data Inconsistency"
                ) : (
                  "Get Your Risk Assessment"
                )}
              </Button>
              <p className="text-xs text-zinc-600 text-center max-w-md">
                This tool provides automated risk indicators only. It does not provide tax advice.
              </p>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default AssessmentPage;
