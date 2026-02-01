import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, ChevronRight, FileCheck, AlertTriangle, CheckCircle, Lock, BarChart3, Building2, Sparkles, Users } from "lucide-react";

const HomePage = () => {
  const navigate = useNavigate();
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Hero Section */}
      <section className="hero-section min-h-screen flex flex-col relative">
        <div className="absolute inset-0 grid-pattern opacity-50"></div>
        
        <nav className="relative z-10 px-6 md:px-12 py-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/20 border border-teal-500/30">
              <Shield className="h-6 w-6 text-teal-400" />
            </div>
            <div>
              <span className="font-serif text-xl font-bold text-white">HMRC Risk Engine</span>
              <span className="ml-2 text-xs bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded">PRO V2</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => navigate('/dashboard')} data-testid="dashboard-nav-btn">
              <Users className="h-4 w-4 mr-2" />My Account
            </Button>
            <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => navigate('/admin')} data-testid="admin-nav-btn">
              Admin
            </Button>
          </div>
        </nav>

        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-24 max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 rounded-full px-4 py-2 text-sm text-teal-400">
                <Sparkles className="h-4 w-4" />
                Industry-Aware Analysis
              </div>
              
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight">
                Professional<br />
                <span className="gradient-text">HMRC Risk Analysis</span>
              </h1>
              
              <p className="text-lg text-zinc-400 max-w-xl leading-relaxed">
                Industry-specific risk scoring with full transparency. Understand exactly what affects your HMRC risk profile and how to document properly.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  data-testid="start-assessment-btn"
                  className="bg-teal-600 hover:bg-teal-500 text-white px-8 py-6 text-lg rounded-xl transition-all active:scale-95 glow-teal"
                  onClick={() => navigate('/assess')}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                >
                  Start Risk Assessment
                  <ChevronRight className={`ml-2 h-5 w-5 transition-transform ${isHovering ? 'translate-x-1' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Feature Cards */}
            <div className="hidden lg:block space-y-4">
              <div className="glass rounded-xl p-6 border border-zinc-800/50">
                <Building2 className="h-8 w-8 text-teal-400 mb-3" />
                <h3 className="font-semibold text-white mb-2">Industry-Specific Thresholds</h3>
                <p className="text-sm text-zinc-500">Risk scoring adapts to your trade - PHV, Construction, IT, Retail, and more.</p>
              </div>
              <div className="glass rounded-xl p-6 border border-zinc-800/50">
                <BarChart3 className="h-8 w-8 text-amber-400 mb-3" />
                <h3 className="font-semibold text-white mb-2">Full Transparency</h3>
                <p className="text-sm text-zinc-500">See exactly what affects your score with detailed explanations and documentation tips.</p>
              </div>
              <div className="glass rounded-xl p-6 border border-zinc-800/50">
                <FileCheck className="h-8 w-8 text-emerald-400 mb-3" />
                <h3 className="font-semibold text-white mb-2">What-If Simulator</h3>
                <p className="text-sm text-zinc-500">Test different scenarios and see how changes affect your risk score in real-time.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 px-6 md:px-12 py-8 border-t border-zinc-800/50">
          <div className="flex flex-wrap justify-center gap-8 text-zinc-500 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-teal-500" />
              <span>6 Industry Profiles</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-teal-500" />
              <span>12+ Risk Indicators</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-teal-500" />
              <span>Live Simulation</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6 md:px-12 bg-[#0d0d14]">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-serif text-3xl font-bold text-white text-center mb-4">Simple Pricing</h2>
          <p className="text-zinc-500 text-center mb-12">Get your free risk score, then unlock the full report</p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card-dark p-8 border-zinc-800">
              <h3 className="font-serif text-xl text-white mb-2">Basic Report</h3>
              <div className="text-3xl font-bold text-white mb-4">£19.99</div>
              <ul className="space-y-3 text-zinc-400 text-sm mb-6">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-teal-500" />Risk score & band</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-teal-500" />Basic indicator breakdown</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-teal-500" />PDF download</li>
              </ul>
            </div>
            <div className="card-dark p-8 border-teal-500/50 relative">
              <div className="absolute -top-3 right-6 bg-teal-500 text-white text-xs px-3 py-1 rounded-full">RECOMMENDED</div>
              <h3 className="font-serif text-xl text-white mb-2">PRO Report</h3>
              <div className="text-3xl font-bold text-teal-400 mb-4">£29.99</div>
              <ul className="space-y-3 text-zinc-400 text-sm mb-6">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-teal-500" />Everything in Basic</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-teal-500" />Industry comparison</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-teal-500" />Detailed HMRC context</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-teal-500" />Documentation tips</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-teal-500" />Future risk guidance</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 md:px-12 bg-[#0a0a0f] border-t border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-teal-500" />
              <span className="font-serif font-semibold text-white">HMRC Risk Engine PRO</span>
            </div>
            <p className="text-xs text-zinc-600 text-center md:text-right max-w-lg">
              This tool provides automated risk indicators only. It does not provide tax advice and does not submit or amend tax returns.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
