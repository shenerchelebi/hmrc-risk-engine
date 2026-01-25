import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, CheckCircle, Loader2, FileText, Mail } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  
  const [status, setStatus] = useState('checking');
  const [paymentData, setPaymentData] = useState(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus();
    } else {
      setStatus('error');
    }
  }, [sessionId]);

  const pollPaymentStatus = async () => {
    const maxAttempts = 10;
    const pollInterval = 2000;

    const checkStatus = async (attempt) => {
      if (attempt >= maxAttempts) {
        setStatus('timeout');
        return;
      }

      try {
        const response = await axios.get(`${API}/checkout/status/${sessionId}`);
        const data = response.data;
        
        if (data.payment_status === 'paid') {
          setPaymentData(data);
          setStatus('success');
          toast.success('Payment successful! Your report is ready.');
          return;
        } else if (data.status === 'expired') {
          setStatus('expired');
          return;
        }
        
        setPollCount(attempt + 1);
        setTimeout(() => checkStatus(attempt + 1), pollInterval);
      } catch (error) {
        console.error('Status check error:', error);
        if (attempt < maxAttempts - 1) {
          setTimeout(() => checkStatus(attempt + 1), pollInterval);
        } else {
          setStatus('error');
        }
      }
    };

    checkStatus(0);
  };

  const handleDownload = () => {
    if (paymentData?.assessment_id) {
      window.open(`${API}/report/download/${paymentData.assessment_id}`, '_blank');
    }
  };

  const handleViewResults = () => {
    if (paymentData?.assessment_id) {
      navigate(`/results/${paymentData.assessment_id}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="bg-[#0d0d14] border-b border-zinc-800 px-6 md:px-12 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-500" />
            <span className="font-serif font-semibold text-white">HMRC Red-Flag Detector</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 md:px-12 py-16">
        <div className="max-w-xl mx-auto">
          {status === 'checking' && (
            <Card className="card-dark border-zinc-800">
              <CardContent className="p-12 text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full bg-teal-500/20"></div>
                  <Loader2 className="absolute inset-0 m-auto h-10 w-10 animate-spin text-teal-500" />
                </div>
                <h1 className="font-serif text-2xl font-bold text-white mb-3">
                  Processing Your Payment
                </h1>
                <p className="text-zinc-500 mb-6">
                  Please wait while we confirm your payment and generate your report...
                </p>
                <div className="flex justify-center gap-1">
                  {[...Array(10)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-2 h-2 rounded-full transition-colors ${i <= pollCount ? 'bg-teal-500' : 'bg-zinc-700'}`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {status === 'success' && (
            <Card className="card-dark border-zinc-800">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 glow-emerald">
                  <CheckCircle className="h-10 w-10 text-emerald-400" />
                </div>
                <h1 className="font-serif text-2xl font-bold text-white mb-3">
                  Payment Successful!
                </h1>
                <p className="text-zinc-500 mb-8">
                  Your full HMRC Risk Report has been generated and is ready for download.
                </p>

                <div className="space-y-4">
                  <Button
                    onClick={handleDownload}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-8 py-6 text-lg w-full rounded-xl"
                    data-testid="download-pdf-btn"
                  >
                    <FileText className="mr-2 h-5 w-5" />
                    Download PDF Report
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleViewResults}
                    className="w-full py-6 border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-xl"
                    data-testid="view-results-btn"
                  >
                    View Results Page
                  </Button>
                </div>

                <div className="mt-8 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                  <div className="flex items-center justify-center gap-2 text-zinc-400">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">A copy has also been sent to your email</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {status === 'timeout' && (
            <Card className="card-dark border-zinc-800">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Loader2 className="h-10 w-10 text-amber-400" />
                </div>
                <h1 className="font-serif text-2xl font-bold text-white mb-3">
                  Taking Longer Than Expected
                </h1>
                <p className="text-zinc-500 mb-8">
                  Your payment is being processed. Please check your email for confirmation, 
                  or try refreshing this page in a few minutes.
                </p>
                <Button onClick={() => window.location.reload()} className="w-full bg-zinc-800 hover:bg-zinc-700">
                  Refresh Page
                </Button>
              </CardContent>
            </Card>
          )}

          {status === 'error' && (
            <Card className="card-dark border-zinc-800">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">⚠️</span>
                </div>
                <h1 className="font-serif text-2xl font-bold text-white mb-3">
                  Something Went Wrong
                </h1>
                <p className="text-zinc-500 mb-8">
                  We couldn't verify your payment. If you were charged, please contact support 
                  with your session ID.
                </p>
                <div className="text-xs text-zinc-600 mb-6 font-mono bg-zinc-800 p-2 rounded">
                  Session: {sessionId || 'Not found'}
                </div>
                <Button onClick={() => navigate('/')} className="w-full bg-teal-600 hover:bg-teal-500">
                  Return Home
                </Button>
              </CardContent>
            </Card>
          )}

          {status === 'expired' && (
            <Card className="card-dark border-zinc-800">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 bg-zinc-700 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">⏱️</span>
                </div>
                <h1 className="font-serif text-2xl font-bold text-white mb-3">
                  Session Expired
                </h1>
                <p className="text-zinc-500 mb-8">
                  Your checkout session has expired. Please start a new assessment to try again.
                </p>
                <Button onClick={() => navigate('/assess')} className="w-full bg-teal-600 hover:bg-teal-500">
                  Start New Assessment
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default PaymentSuccessPage;
