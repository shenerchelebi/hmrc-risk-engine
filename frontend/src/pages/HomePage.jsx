import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, ChevronRight, FileCheck, AlertTriangle, CheckCircle, Lock } from "lucide-react";

const HomePage = () => {
  const navigate = useNavigate();
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="hero-section min-h-[90vh] flex flex-col">
        {/* Navigation */}
        <nav className="px-6 md:px-12 py-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-teal-400" />
            <span className="font-serif text-2xl font-bold text-white">HMRC Red-Flag Detector</span>
          </div>
          <Button 
            variant="ghost" 
            className="text-stone-300 hover:text-white hover:bg-white/10"
            onClick={() => navigate('/admin')}
            data-testid="admin-nav-btn"
          >
            Admin
          </Button>
        </nav>

        {/* Hero Content */}
        <div className="flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-24 max-w-6xl">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 text-sm text-stone-300">
              <Lock className="h-4 w-4" />
              Secure & Confidential Analysis
            </div>
            
            <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-tight">
              Know Your HMRC<br />
              <span className="text-teal-400">Risk Score</span>
            </h1>
            
            <p className="text-lg md:text-xl text-stone-300 max-w-xl leading-relaxed">
              Our automated risk indicator analyses your self-assessment figures against 
              HMRC's known audit patterns. Get your free risk assessment in under 2 minutes.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                data-testid="start-assessment-btn"
                className="bg-teal-600 hover:bg-teal-500 text-white px-8 py-6 text-lg rounded-lg transition-all active:scale-95"
                onClick={() => navigate('/assess')}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              >
                Start Free Assessment
                <ChevronRight className={`ml-2 h-5 w-5 transition-transform ${isHovering ? 'translate-x-1' : ''}`} />
              </Button>
              <Button
                variant="outline"
                className="border-stone-500 text-stone-300 hover:bg-white/10 hover:text-white px-8 py-6 text-lg rounded-lg"
                onClick={() => document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' })}
              >
                How It Works
              </Button>
            </div>
          </div>
        </div>

        {/* Trust indicators */}
        <div className="px-6 md:px-12 py-8 border-t border-white/10">
          <div className="flex flex-wrap justify-center md:justify-start gap-8 text-stone-400 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-teal-500" />
              <span>Based on HMRC public data</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-teal-500" />
              <span>No data stored unnecessarily</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-teal-500" />
              <span>Instant results</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-6 md:px-12 bg-stone-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4">
            How It Works
          </h2>
          <p className="text-stone-600 text-center mb-16 max-w-2xl mx-auto">
            Our deterministic scoring engine analyses your figures against known HMRC risk patterns
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="card-elevated p-8 text-center">
              <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="font-serif text-xl font-semibold text-slate-900 mb-3">
                Enter Your Figures
              </h3>
              <p className="text-stone-600">
                Provide your turnover, expenses, motor costs, mileage, and other key self-assessment figures.
              </p>
            </div>

            {/* Step 2 */}
            <div className="card-elevated p-8 text-center">
              <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="font-serif text-xl font-semibold text-slate-900 mb-3">
                Get Your Score
              </h3>
              <p className="text-stone-600">
                Receive your FREE risk score and band (LOW, MODERATE, or HIGH) instantly.
              </p>
            </div>

            {/* Step 3 */}
            <div className="card-elevated p-8 text-center">
              <div className="w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileCheck className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-slate-900 mb-3">
                Unlock Full Report
              </h3>
              <p className="text-stone-600">
                For £19.99, get a detailed AI-powered PDF report with specific recommendations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Risk Factors Section */}
      <section className="py-20 px-6 md:px-12 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4">
            What We Analyse
          </h2>
          <p className="text-stone-600 text-center mb-16 max-w-2xl mx-auto">
            Our scoring engine checks for 12+ risk indicators that HMRC typically flags
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Profit Margins", desc: "Low profit ratios attract scrutiny" },
              { title: "Expense Ratios", desc: "High expense claims relative to turnover" },
              { title: "Motor Costs", desc: "Vehicle expenses and mileage claims" },
              { title: "Home Office", desc: "Working from home deductions" },
              { title: "Travel Claims", desc: "Business travel and subsistence" },
              { title: "Consecutive Losses", desc: "Multiple years of losses" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-lg border border-stone-200 bg-stone-50">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-slate-900">{item.title}</h4>
                  <p className="text-sm text-stone-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 md:px-12 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Check Your Risk?
          </h2>
          <p className="text-stone-300 mb-8 text-lg">
            Get your free risk assessment in under 2 minutes. No signup required.
          </p>
          <Button
            data-testid="cta-start-btn"
            className="bg-teal-600 hover:bg-teal-500 text-white px-10 py-6 text-lg rounded-lg transition-all active:scale-95"
            onClick={() => navigate('/assess')}
          >
            Start Your Assessment
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 md:px-12 bg-stone-100 border-t border-stone-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-slate-900" />
              <span className="font-serif font-semibold text-slate-900">HMRC Red-Flag Detector</span>
            </div>
            <p className="text-xs text-stone-500 text-center md:text-right max-w-lg">
              This tool provides an automated risk indicator based on user-entered figures and public 
              statistical patterns. It does not provide tax advice and does not submit or amend tax returns.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
