import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { UserProfile } from '../services/userService';

type EditUserModalProps = {
  user: UserProfile;
  onSave: (user: UserProfile) => void;
  onClose: () => void;
};

export default function EditUserModal({ user, onSave, onClose }: EditUserModalProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'student'|'admin'>('student');
  const [tier, setTier] = useState<'free' | 'pro'>('free');
  const [tierExpiry, setTierExpiry] = useState<string>('');

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setRole((user.role as 'student'|'admin') || 'student');
      setTier((user.tier as 'free'|'pro') || 'free');
      setTierExpiry(user.tierExpiry || '');
    }
  }, [user]);

  const handleSave = () => {
    onSave({ ...user, email, firstName, lastName, role, tier, tierExpiry: tierExpiry || null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800">Edit User</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-4 text-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
              <input 
                type="text" 
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
              <input 
                type="text" 
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value as 'student'|'admin')}
              className="w-full border border-slate-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tier</label>
            <select 
              value={tier}
              onChange={(e) => setTier(e.target.value as 'free' | 'pro')}
              className="w-full border border-slate-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
            </select>
          </div>

          {tier === 'pro' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tier Expiry Date</label>
              <input 
                type="date" 
                value={tierExpiry}
                onChange={(e) => setTierExpiry(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">Leave blank for indefinite access.</p>
            </div>
          )}


        </div>

        <div className="border-t border-slate-100 p-4 bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium transition"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 transition"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
}
