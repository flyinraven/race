import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, ShieldUser, Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';

export default function Login() {
  const { signIn, signUp, resetPassword, role } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [plan, setPlan] = useState<'free' | 'pro'>('free');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  React.useEffect(() => {
    if (role === 'admin') navigate('/admin');
    else if (role === 'student') navigate('/dashboard');
  }, [role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }
    
    if (view === 'signup' && (!firstName || !lastName)) {
      setError('Please enter your first and last name.');
      return;
    }

    setLoading(true);
    let isStuck = setTimeout(() => {
      setLoading(false);
      setError('Registration taking longer than expected. Please check your network or try again.');
    }, 20000); // 20s safety timeout

    try {
      if (view === 'signin') {
        const success = await signIn(email, password);
        clearTimeout(isStuck);
        if (!success) {
          setError('Setting up your profile, please wait...');
          return;
        }
      } else if (view === 'signup') {
        await signUp(email, password, plan, firstName, lastName);
        clearTimeout(isStuck);
        // Do not navigate immediately because Supabase requires email confirmation!
        // Instead, we show a success message by resetting view to a new state or showing error as success.
        setError('success:Account created! Please check your email to confirm your account.');
        return;
      }
    } catch (err: any) {
      clearTimeout(isStuck);
      setError(err.message || 'An error occurred.');
    } finally {
      clearTimeout(isStuck);
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email.');
      return;
    }
    setLoading(true);
    let isStuck = setTimeout(() => {
      setLoading(false);
      setError('Request is taking too long. Please try again.');
    }, 20000);

    try {
      await resetPassword(email);
      clearTimeout(isStuck);
      setResetSent(true);
      setError('');
    } catch (err: any) {
      clearTimeout(isStuck);
      setError(err.message || 'Failed to send reset email.');
    } finally {
      clearTimeout(isStuck);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-8">
          <BookOpen className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">RANZCO RACE Exam Engine</h1>
          <p className="text-slate-500 mt-2">
            {view === 'signin' && "Sign in to access your dashboard"}
            {view === 'signup' && "Create your account"}
            {view === 'forgot' && "Reset your password"}
          </p>
        </div>

        {error && error.startsWith('success:') ? (
          <div className="mb-4 bg-green-50 text-green-700 p-3 rounded-lg text-sm border border-green-100">
            {error.replace('success:', '')}
          </div>
        ) : error && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
            {error}
          </div>
        )}

        {view === 'forgot' ? (
          <div>
            {resetSent ? (
              <div className="text-center">
                <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 border border-green-100">
                  Password reset link has been sent to your email!
                </div>
                <button 
                  onClick={() => { setView('signin'); setResetSent(false); }}
                  className="text-blue-600 font-medium hover:text-blue-800 transition"
                >
                  Back to Log In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Send Reset Link
                </button>
                <div className="text-center mt-4">
                  <button 
                    type="button" 
                    onClick={() => setView('signin')}
                    className="text-sm text-slate-500 hover:text-slate-800 transition"
                  >
                    Back to Log In
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {view === 'signup' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                  <input 
                    type="text" 
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <input 
                    type="text" 
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Doe"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="student@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {view === 'signup' && (
              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Choose Plan</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPlan('free')}
                    className={`border rounded-lg p-3 text-sm font-medium transition ${plan === 'free' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    Free Trial
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlan('pro')}
                    className={`border rounded-lg p-3 text-sm font-medium transition ${plan === 'pro' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    Premium ($29/mo)
                  </button>
                </div>
              </div>
            )}

            {view === 'signin' && (
              <div className="flex justify-end pt-1">
                <button 
                  type="button" 
                  onClick={() => setView('forgot')}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 transition"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 mt-4"
            >
              {loading ? 'Processing...' : (view === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
            
            <div className="text-center pt-4 border-t border-slate-100 mt-6">
              {view === 'signin' ? (
                <p className="text-sm text-slate-600">
                  Don't have an account?{' '}
                  <button 
                    type="button" 
                    onClick={() => setView('signup')}
                    className="font-medium text-blue-600 hover:text-blue-800 transition"
                  >
                    Sign Up
                  </button>
                </p>
              ) : (
                <p className="text-sm text-slate-600">
                  Already have an account?{' '}
                  <button 
                    type="button" 
                    onClick={() => setView('signin')}
                    className="font-medium text-blue-600 hover:text-blue-800 transition"
                  >
                    Sign In
                  </button>
                </p>
              )}
            </div>
          </form>
        )}

        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
            <Link to="/privacy" className="hover:text-slate-600 transition">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-slate-600 transition">Terms & Conditions</Link>
            <Link to="/billing" className="hover:text-slate-600 transition">Billing Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
