import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import HomePage from "@/pages/HomePage";
import AssessmentPage from "@/pages/AssessmentPage";
import ResultsPage from "@/pages/ResultsPage";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage";
import AdminPage from "@/pages/AdminPage";

function App() {
  return (
    <div className="App min-h-screen bg-stone-50 paper-texture">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/assess" element={<AssessmentPage />} />
          <Route path="/results/:id" element={<ResultsPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
