/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ExamInterface from './pages/ExamInterface';
import AdminDashboard from './pages/AdminDashboard';
import Pricing from './pages/Pricing';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsConditions from './pages/TermsConditions';
import BillingPolicy from './pages/BillingPolicy';
import Profile from './pages/Profile';
import ResetPassword from './pages/ResetPassword';

function PrivateRoute({ children, requiredRole }: { children: React.ReactNode, requiredRole?: 'student' | 'admin' }) {
  const { user, role, loading } = useAuth();
  
  if (loading) return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/" />;
  if (requiredRole && role !== requiredRole && !(requiredRole === 'student' && role === 'admin')) return <Navigate to="/" />;
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsConditions />} />
      <Route path="/billing" element={<BillingPolicy />} />
      <Route 
        path="/profile" 
        element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <PrivateRoute requiredRole="student">
            <Dashboard />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/exam/:examId" 
        element={
          <PrivateRoute requiredRole="student">
            <ExamInterface />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/admin" 
        element={
          <PrivateRoute requiredRole="admin">
            <AdminDashboard />
          </PrivateRoute>
        } 
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

