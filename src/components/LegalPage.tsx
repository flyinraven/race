import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LegalPage({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link to="/dashboard" className="text-slate-500 hover:text-slate-800 flex items-center gap-2 mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-slate-900">{title}</h1>
          <div className="mt-2 text-sm text-slate-500">Last Updated: {new Date().toLocaleDateString()}</div>
        </div>
        <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200 prose prose-slate max-w-none">
          {children}
        </div>
      </div>
    </div>
  );
}
