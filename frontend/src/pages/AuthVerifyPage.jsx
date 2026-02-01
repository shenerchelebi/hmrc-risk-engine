import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthVerifyPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying');

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setStatus('error');
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await axios.post(`${API}/auth/verify`, { token });
      if (response.data.access_token) {
        localStorage.setItem('user_token', response.data.access_token);
        toast.success('Login successful!');
        setStatus('success');
        setTimeout(() => navigate('/dashboard'), 1500);
      }
    } catch (error) {
      setStatus('error');
      toast.error(error.response?.data?.detail || 'Invalid or expired link');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <header className="bg-[#0d0d14] border-b border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center">
          <Shield className="h-6 w-6 text-teal-500 mr-2" />
          <span className="font-serif font-semibold text-white">HMRC Risk Engine PRO</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="card-dark border-zinc-800 w-full max-w-md">
          <CardContent className="p-12 text-center">
            {status === 'verifying' && (
              <>
                <Loader2 className="h-16 w-16 animate-spin text-teal-500 mx-auto mb-6" />
                <h1 className="font-serif text-2xl font-bold text-white mb-3">Verifying Your Link</h1>
                <p className="text-zinc-500">Please wait...</p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-6" />
                <h1 className="font-serif text-2xl font-bold text-white mb-3">Login Successful!</h1>
                <p className="text-zinc-500">Redirecting to your dashboard...</p>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="h-16 w-16 text-rose-500 mx-auto mb-6" />
                <h1 className="font-serif text-2xl font-bold text-white mb-3">Link Invalid or Expired</h1>
                <p className="text-zinc-500 mb-6">Please request a new login link.</p>
                <Button onClick={() => navigate('/dashboard')} className="bg-teal-600 hover:bg-teal-500">
                  Request New Link
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AuthVerifyPage;
