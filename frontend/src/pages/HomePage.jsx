import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, ChevronRight, FileCheck, AlertTriangle, CheckCircle, Lock, BarChart3, FileText } from "lucide-react";

const HomePage = () => {
  const navigate = useNavigate();
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Hero Section */}
      <section className="hero-section min-h-screen flex flex-col relative">
        <div className="absolute inset-0 grid-pattern opacity-50"></div>
        
        {/* Navigation */}
        <nav className="relative z-10 px-6 md:px-12 py-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/20 border border-teal-500/30">
              <Shield className="h-6 w-6 text-teal-400" />
            </div>
            <span className="font-serif text-xl font-bold text-white">HMRC Red-Flag Detector</span>
          </div>
          <Button 
            variant="ghost" 
            className="text-zinc-400 hover:text-white hover:bg-white/10"
            onClick={() => navigate('/admin')}
            data-testid="admin-nav-btn"
          >
            Admin Portal
          </Button>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-24 max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 rounded-full px-4 py-2 text-sm text-teal-400">
                <Lock className="h-4 w-4" />
                Secure & Confidential Analysis
              </div>
              
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight">
                Know Your<br />
                <span className="gradient-text">HMRC Risk Score</span>
              </h1>
              
              <p className="text-lg text-zinc-400 max-w-xl leading-relaxed">
                Our automated risk indicator analyses your self-assessment figures against 
                HMRC's known audit patterns. Get your free risk assessment in under 2 minutes.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  data-testid="start-assessment-btn"
                  className="bg-teal-600 hover:bg-teal-500 text-white px-8 py-6 text-lg rounded-xl transition-all active:scale-95 glow-teal"
                  onClick={() => navigate('/assess')}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                >
                  Start Free Assessment
                  <ChevronRight className={`ml-2 h-5 w-5 transition-transform ${isHovering ? 'translate-x-1' : ''}`} />
                </Button>
                <Button
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white px-8 py-6 text-lg rounded-xl"
                  onClick={() => document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' })}
                >
                  How It Works
                </Button>
              </div>
            </div>

            {/* Stats Preview */}
            <div className="hidden lg:block">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 rounded-3xl blur-xl"></div>
                <div className="relative glass rounded-2xl p-8 space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-zinc-400 text-sm">Sample Risk Assessment</span>
                    <BarChart3 className="h-5 w-5 text-teal-400" />
                  </div>
                  
                  <div className="text-center py-6">
                    <div className="w-32 h-32 mx-auto rounded-full bg-amber-500/20 border-4 border-amber-500/50 flex items-center justify-center glow-amber">
                      <span className="text-4xl font-bold text-amber-400">42</span>
                    </div>
                    <p className="mt-4 text-amber-400 font-semibold">MODERATE RISK</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Expense Ratio</span>
                      <span className="text-zinc-300">62%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Profit Margin</span>
                      <span className="text-zinc-300">8%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Flags Triggered</span>
                      <span className="text-amber-400">3</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust indicators */}
        <div className="relative z-10 px-6 md:px-12 py-8 border-t border-zinc-800/50">
          <div className="flex flex-wrap justify-center gap-8 text-zinc-500 text-sm">
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
      <section id="how-it-works" className="py-24 px-6 md:px-12 bg-[#0d0d14] relative">
        <div className="absolute inset-0 grid-pattern opacity-30"></div>
        <div className="max-w-6xl mx-auto relative z-10">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-white text-center mb-4">
            How It Works
          </h2>
          <p className="text-zinc-500 text-center mb-16 max-w-2xl mx-auto">
            Our deterministic scoring engine analyses your figures against known HMRC risk patterns
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: "1", title: "Enter Your Figures", desc: "Provide your turnover, expenses, motor costs, mileage, and other key self-assessment figures.", icon: FileText },
              { num: "2", title: "Get Your Score", desc: "Receive your FREE risk score and band (LOW, MODERATE, or HIGH) instantly.", icon: BarChart3 },
              { num: "3", title: "Unlock Full Report", desc: "For £19.99, get a detailed AI-powered PDF report with specific recommendations.", icon: FileCheck },
            ].map((step, i) => (
              <div key={i} className="card-dark p-8 text-center hover:border-teal-500/30 transition-colors">
                <div className={`w-16 h-16 ${i === 2 ? 'bg-teal-600' : 'bg-zinc-800'} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
                  <step.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="font-serif text-xl font-semibold text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-zinc-500">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Risk Factors Section */}
      <section className="py-24 px-6 md:px-12 bg-[#0a0a0f]">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-white text-center mb-4">
            What We Analyse
          </h2>
          <p className="text-zinc-500 text-center mb-16 max-w-2xl mx-auto">
            Our scoring engine checks for 12+ risk indicators that HMRC typically flags
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: "Profit Margins", desc: "Low profit ratios attract scrutiny" },
              { title: "Expense Ratios", desc: "High expense claims relative to turnover" },
              { title: "Motor Costs", desc: "Vehicle expenses and mileage claims" },
              { title: "Home Office", desc: "Working from home deductions" },
              { title: "Travel Claims", desc: "Business travel and subsistence" },
              { title: "Consecutive Losses", desc: "Multiple years of losses" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-amber-500/30 transition-colors">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-white">{item.title}</h4>
                  <p className="text-sm text-zinc-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 md:px-12 bg-gradient-to-b from-[#0a0a0f] to-[#0d1117]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Check Your Risk?
          </h2>
          <p className="text-zinc-400 mb-8 text-lg">
            Get your free risk assessment in under 2 minutes. No signup required.
          </p>
          <Button
            data-testid="cta-start-btn"
            className="bg-teal-600 hover:bg-teal-500 text-white px-10 py-6 text-lg rounded-xl transition-all active:scale-95 glow-teal"
            onClick={() => navigate('/assess')}
          >
            Start Your Assessment
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 md:px-12 bg-[#0a0a0f] border-t border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-teal-500" />
              <span className="font-serif font-semibold text-white">HMRC Red-Flag Detector</span>
            </div>
            <p className="text-xs text-zinc-600 text-center md:text-right max-w-lg">
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
