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
import { Shield, ArrowLeft, HelpCircle, Loader2, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AssessmentPage = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    tax_year: "2023-24",
    turnover: "",
    total_expenses: "",
    motor_costs: "",
    mileage_claimed: "",
    method: "actual",
    home_office_amount: "",
    phone_internet: "",
    travel_subsistence: "",
    marketing: "",
    loss_this_year: false,  // Default is false
    loss_last_year: false,  // Default is false
    other_income: false,
    email: ""
  });

  // DERIVED PROFIT: Computed from turnover - total_expenses
  const calculatedProfit = useMemo(() => {
    const turnover = parseFloat(formData.turnover) || 0;
    const expenses = parseFloat(formData.total_expenses) || 0;
    return turnover - expenses;
  }, [formData.turnover, formData.total_expenses]);

  // Validation: Check for data inconsistency (loss checkbox true but profit positive)
  const hasDataInconsistency = useMemo(() => {
    return formData.loss_this_year && calculatedProfit > 0;
  }, [formData.loss_this_year, calculatedProfit]);

  // Check if form can be submitted
  const canSubmit = useMemo(() => {
    return !hasDataInconsistency && formData.email && formData.turnover;
  }, [hasDataInconsistency, formData.email, formData.turnover]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Block submission if data inconsistency exists
    if (hasDataInconsistency) {
      toast.error("Please resolve the data inconsistency before submitting");
      return;
    }
    
    setIsSubmitting(true);

    try {
      if (!formData.email || !formData.turnover) {
        toast.error("Please fill in all required fields");
        setIsSubmitting(false);
        return;
      }

      const submitData = {
        ...formData,
        turnover: parseFloat(formData.turnover) || 0,
        total_expenses: parseFloat(formData.total_expenses) || 0,
        motor_costs: parseFloat(formData.motor_costs) || 0,
        mileage_claimed: parseFloat(formData.mileage_claimed) || 0,
        home_office_amount: parseFloat(formData.home_office_amount) || 0,
        phone_internet: parseFloat(formData.phone_internet) || 0,
        travel_subsistence: parseFloat(formData.travel_subsistence) || 0,
        marketing: parseFloat(formData.marketing) || 0
      };

      const response = await axios.post(`${API}/assessment/submit`, submitData);
      
      if (response.data.success) {
        toast.success("Assessment complete!");
        navigate(`/results/${response.data.assessment_id}`);
      }
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(error.response?.data?.detail || "Failed to submit assessment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const InputWithTooltip = ({ id, label, tooltip, value, onChange, placeholder, type = "number", required = false, readOnly = false }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-sm font-medium text-zinc-300">
          {label} {required && <span className="text-teal-500">*</span>}
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-zinc-600 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-200">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`h-12 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-teal-500 focus:ring-teal-500 ${readOnly ? 'bg-zinc-800 cursor-not-allowed' : ''}`}
        data-testid={`input-${id}`}
      />
    </div>
  );

  // Format profit display
  const profitDisplay = calculatedProfit >= 0 
    ? `£${calculatedProfit.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `-£${Math.abs(calculatedProfit).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="bg-[#0d0d14] border-b border-zinc-800 px-6 md:px-12 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
            data-testid="back-btn"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-500" />
            <span className="font-serif font-semibold text-white">HMRC Red-Flag Detector</span>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="px-6 md:px-12 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-white mb-3">
              Self-Assessment Risk Check
            </h1>
            <p className="text-zinc-500">
              Enter your figures below. All calculations are done securely in real-time.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info Card */}
            <Card className="card-dark form-card border-zinc-800">
              <CardHeader>
                <CardTitle className="font-serif text-xl text-white">Basic Information</CardTitle>
                <CardDescription className="text-zinc-500">Select your tax year and enter your email</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-zinc-300">Tax Year *</Label>
                    <Select 
                      value={formData.tax_year} 
                      onValueChange={(v) => handleChange('tax_year', v)}
                    >
                      <SelectTrigger className="h-12 bg-zinc-900 border-zinc-700 text-white" data-testid="select-tax-year">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        <SelectItem value="2023-24">2023-24</SelectItem>
                        <SelectItem value="2022-23">2022-23</SelectItem>
                        <SelectItem value="2021-22">2021-22</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <InputWithTooltip
                    id="email"
                    label="Email Address"
                    tooltip="We'll send your report to this email if you purchase the full analysis"
                    value={formData.email}
                    onChange={(v) => handleChange('email', v)}
                    placeholder="your@email.com"
                    type="email"
                    required
                  />
                </div>
              </CardContent>
            </Card>

            {/* Income & Expenses Card */}
            <Card className="card-dark form-card border-zinc-800" style={{ animationDelay: '0.1s' }}>
              <CardHeader>
                <CardTitle className="font-serif text-xl text-white">Income & Expenses</CardTitle>
                <CardDescription className="text-zinc-500">Your main self-assessment figures</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <InputWithTooltip
                    id="turnover"
                    label="Turnover (Annual)"
                    tooltip="Total business income before expenses"
                    value={formData.turnover}
                    onChange={(v) => handleChange('turnover', v)}
                    placeholder="£"
                    required
                  />
                  <InputWithTooltip
                    id="total_expenses"
                    label="Total Expenses"
                    tooltip="All allowable business expenses combined"
                    value={formData.total_expenses}
                    onChange={(v) => handleChange('total_expenses', v)}
                    placeholder="£"
                  />
                </div>
                
                {/* Derived Profit Field - Read Only */}
                <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium text-zinc-400">Calculated Profit/Loss</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-zinc-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-200">
                            <p>Automatically calculated as Turnover minus Total Expenses</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span className={`text-lg font-semibold ${calculatedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} data-testid="calculated-profit">
                      {profitDisplay}
                    </span>
                  </div>
                  {calculatedProfit <= 0 && (
                    <p className="text-xs text-amber-500 mt-2">
                      Your figures show a loss. This will be factored into the risk assessment.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Motor Expenses Card */}
            <Card className="card-dark form-card border-zinc-800" style={{ animationDelay: '0.2s' }}>
              <CardHeader>
                <CardTitle className="font-serif text-xl text-white">Motor Expenses</CardTitle>
                <CardDescription className="text-zinc-500">Vehicle and travel-related claims</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-zinc-300">Expense Method *</Label>
                  <RadioGroup 
                    value={formData.method} 
                    onValueChange={(v) => handleChange('method', v)}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="actual" id="actual" className="border-zinc-600 text-teal-500" data-testid="radio-actual" />
                      <Label htmlFor="actual" className="cursor-pointer text-zinc-300">Actual Costs</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="mileage" id="mileage" className="border-zinc-600 text-teal-500" data-testid="radio-mileage" />
                      <Label htmlFor="mileage" className="cursor-pointer text-zinc-300">Mileage Rate (45p/mile)</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <InputWithTooltip
                    id="motor_costs"
                    label="Motor Costs"
                    tooltip="Fuel, insurance, repairs, etc. (if using actual costs method)"
                    value={formData.motor_costs}
                    onChange={(v) => handleChange('motor_costs', v)}
                    placeholder="£"
                  />
                  <InputWithTooltip
                    id="mileage_claimed"
                    label="Business Miles"
                    tooltip="Total business miles if using mileage method"
                    value={formData.mileage_claimed}
                    onChange={(v) => handleChange('mileage_claimed', v)}
                    placeholder="Miles"
                  />
                </div>

                <InputWithTooltip
                  id="travel_subsistence"
                  label="Travel & Subsistence"
                  tooltip="Business travel, hotels, meals while away"
                  value={formData.travel_subsistence}
                  onChange={(v) => handleChange('travel_subsistence', v)}
                  placeholder="£"
                />
              </CardContent>
            </Card>

            {/* Other Expenses Card */}
            <Card className="card-dark form-card border-zinc-800" style={{ animationDelay: '0.3s' }}>
              <CardHeader>
                <CardTitle className="font-serif text-xl text-white">Other Expenses</CardTitle>
                <CardDescription className="text-zinc-500">Additional deductible expenses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <InputWithTooltip
                    id="home_office_amount"
                    label="Home Office"
                    tooltip="Use of home as office - flat rate or proportion of bills"
                    value={formData.home_office_amount}
                    onChange={(v) => handleChange('home_office_amount', v)}
                    placeholder="£"
                  />
                  <InputWithTooltip
                    id="phone_internet"
                    label="Phone & Internet"
                    tooltip="Business proportion of phone and broadband costs"
                    value={formData.phone_internet}
                    onChange={(v) => handleChange('phone_internet', v)}
                    placeholder="£"
                  />
                </div>
                <InputWithTooltip
                  id="marketing"
                  label="Marketing & Advertising"
                  tooltip="Advertising, website costs, promotional materials"
                  value={formData.marketing}
                  onChange={(v) => handleChange('marketing', v)}
                  placeholder="£"
                />
              </CardContent>
            </Card>

            {/* Losses & Additional Card */}
            <Card className="card-dark form-card border-zinc-800" style={{ animationDelay: '0.4s' }}>
              <CardHeader>
                <CardTitle className="font-serif text-xl text-white">Losses & Additional Income</CardTitle>
                <CardDescription className="text-zinc-500">Important context for your assessment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Data Inconsistency Warning */}
                {hasDataInconsistency && (
                  <Alert className="bg-amber-500/10 border-amber-500/50 text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="ml-2">
                      <strong>Data inconsistency:</strong> You selected 'loss', but your figures show a profit of {profitDisplay}. 
                      Please untick the loss checkbox or correct your figures before submitting.
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id="loss_this_year" 
                    checked={formData.loss_this_year}
                    onCheckedChange={(v) => handleChange('loss_this_year', v)}
                    className={`border-zinc-600 data-[state=checked]:bg-teal-600 ${hasDataInconsistency ? 'border-amber-500' : ''}`}
                    data-testid="checkbox-loss-this-year"
                  />
                  <Label htmlFor="loss_this_year" className={`cursor-pointer ${hasDataInconsistency ? 'text-amber-400' : 'text-zinc-300'}`}>
                    I'm declaring a loss this tax year
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id="loss_last_year" 
                    checked={formData.loss_last_year}
                    onCheckedChange={(v) => handleChange('loss_last_year', v)}
                    className="border-zinc-600 data-[state=checked]:bg-teal-600"
                    data-testid="checkbox-loss-last-year"
                  />
                  <Label htmlFor="loss_last_year" className="cursor-pointer text-zinc-300">
                    I also declared a loss last tax year
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id="other_income" 
                    checked={formData.other_income}
                    onCheckedChange={(v) => handleChange('other_income', v)}
                    className="border-zinc-600 data-[state=checked]:bg-teal-600"
                    data-testid="checkbox-other-income"
                  />
                  <Label htmlFor="other_income" className="cursor-pointer text-zinc-300">
                    I have other income sources (employment, rental, etc.)
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex flex-col items-center gap-4 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className={`px-12 py-6 text-lg rounded-xl w-full md:w-auto transition-all active:scale-95 ${
                  canSubmit 
                    ? 'bg-teal-600 hover:bg-teal-500 text-white' 
                    : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                }`}
                data-testid="submit-assessment-btn"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analysing...
                  </>
                ) : hasDataInconsistency ? (
                  "Resolve Data Inconsistency to Continue"
                ) : (
                  "Get Your Free Risk Score"
                )}
              </Button>
              <p className="text-xs text-zinc-600 text-center max-w-md">
                By submitting, you confirm these figures are for informational purposes only. 
                This is not tax advice.
              </p>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default AssessmentPage;
