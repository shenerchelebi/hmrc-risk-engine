import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import HomePage from "@/pages/HomePage";
import AssessmentPage from "@/pages/AssessmentPage";
import ResultsPage from "@/pages/ResultsPage";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage";
import AdminPage from "@/pages/AdminPage";
import AuthVerifyPage from "@/pages/AuthVerifyPage";
import DashboardPage from "@/pages/DashboardPage";

function App() {
  return (
    <div className="App min-h-screen bg-[#0a0a0f]">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/assess" element={<AssessmentPage />} />
          <Route path="/results/:id" element={<ResultsPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/auth/verify" element={<AuthVerifyPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
