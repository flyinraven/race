import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { User, CreditCard, ArrowLeft, Star, Clock } from 'lucide-react';

export default function Profile() {
  const { user, role, tier, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center shadow-sm">
        <button onClick={() => navigate(-1)} className="mr-4 text-slate-500 hover:text-slate-900 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-900 flex-1">My Profile</h1>
        {role === 'admin' && (
          <Link to="/admin" className="text-sm font-bold text-blue-600 hover:text-blue-800 transition mr-4">
            Admin Area
          </Link>
        )}
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-6 md:p-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-4 mb-8 pb-8 border-b border-slate-100">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                <User className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{user?.email}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2.5 py-1 text-xs rounded-full font-semibold flex items-center gap-1 ${tier === 'pro' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                    {tier === 'pro' ? <><Star className="w-3 h-3" /> Premium Member</> : <><Clock className="w-3 h-3" /> Free Trial</>}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-slate-400" />
                Subscription Details
              </h3>
              
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                {tier === 'pro' ? (
                  <div>
                    <p className="text-slate-700 mb-2">You are currently on the <strong>Premium</strong> plan.</p>
                    <p className="text-sm text-slate-500">Your subscription is active and renews automatically. You have full access to all questions and features.</p>
                    <div className="mt-4 pt-4 border-t border-slate-200 flex gap-4">
                      <button 
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/create-portal-session', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userEmail: user?.email })
                            });
                            const data = await res.json();
                            if (data.url) {
                              window.location.href = data.url;
                            } else {
                              alert(data.error || 'Failed to open billing portal. Please check if STRIPE_SECRET_KEY is configured properly and you have an active subscription in Stripe.');
                            }
                          } catch (e) {
                            alert('Failed to connect to billing server.');
                          }
                        }}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        Manage Subscription
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-700 mb-2">You are currently on the <strong>Free Trial</strong>.</p>
                    <p className="text-sm text-slate-500 mb-4">You have limited access to the question bank. Upgrade to Premium to unlock all questions, past papers, and advanced AI features.</p>
                    <Link to="/pricing" className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm">
                      Upgrade to Premium
                    </Link>
                  </div>
                )}
              </div>
            </div>

            <div>
               <h3 className="text-lg font-bold text-slate-900 mb-4">Account Actions</h3>
               <button 
                onClick={() => { signOut(); navigate('/'); }}
                className="text-red-600 font-medium hover:text-red-800 transition"
               >
                 Sign Out
               </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
