import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userEmail: user?.email }),
      });

      const session = await response.json();
      
      if (!response.ok) {
        throw new Error(session.error || 'Failed to initialize Stripe checkout. Make sure STRIPE_SECRET_KEY is configured in your project settings.');
      }

      // Redirect to Stripe checkout
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error('No checkout URL returned.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during checkout setup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <Link to="/dashboard" className="text-slate-500 hover:text-slate-800 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Upgrade to Pro</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="p-8 sm:p-10 bg-indigo-600 text-white text-center">
            <h2 className="text-3xl font-bold mb-4">Pro Subscription</h2>
            <div className="text-5xl font-extrabold mb-2">$29<span className="text-2xl font-medium text-indigo-200">/mo</span></div>
            <p className="text-indigo-100">Cancel anytime. Automatically renews monthly.</p>
          </div>

          <div className="p-8 sm:p-10">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Everything you need to excel:</h3>
            <ul className="space-y-4 mb-10">
              <li className="flex gap-3 text-slate-700">
                <CheckCircle2 className="w-6 h-6 text-indigo-600 shrink-0" />
                <span><strong className="text-slate-900">Infinite Practice Questions:</strong> AI generates fresh, new scenarios instantly based on the RANZCO curriculum.</span>
              </li>
              <li className="flex gap-3 text-slate-700">
                <CheckCircle2 className="w-6 h-6 text-indigo-600 shrink-0" />
                <span><strong className="text-slate-900">AI Intelligent Marking:</strong> Your answers are instantly graded with detailed feedback comparing your response against the model answer.</span>
              </li>
              <li className="flex gap-3 text-slate-700">
                <CheckCircle2 className="w-6 h-6 text-indigo-600 shrink-0" />
                <span><strong className="text-slate-900">Unlimited Access:</strong> Full access to all historic past papers and their standard manual marking guides.</span>
              </li>
            </ul>

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-200 shadow-sm">
                {error}
              </div>
            )}

            <button 
              onClick={handleCheckout}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 px-8 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-75 disabled:cursor-not-allowed text-white text-lg font-semibold rounded-xl shadow-md transition transform hover:-translate-y-0.5 disabled:hover:translate-y-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Preparing Checkout...
                </>
              ) : (
                'Subscribe Now with Stripe'
              )}
            </button>
            <p className="mt-4 text-center text-sm text-slate-500">
              By subscribing, you agree to our <Link to="/terms" className="text-indigo-600 hover:underline">Terms & Conditions</Link> and <Link to="/billing" className="text-indigo-600 hover:underline">Billing Policy</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
