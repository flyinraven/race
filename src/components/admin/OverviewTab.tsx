import React from 'react';
import { Trash2, Edit2 } from 'lucide-react';
import { UserProfile, Submission } from '../../services/userService';

interface OverviewTabProps {
  usersData: UserProfile[];
  newEmail: string;
  setNewEmail: (email: string) => void;
  handleAddUser: () => void;
  setEditingUser: (user: UserProfile | null) => void;
  handleDeleteUser: (id: string) => void;
  submissions: Submission[];
  setSelectedSubmission: (submission: Submission | null) => void;
  handleDeleteSubmission: (id: string) => void;
}

export default function OverviewTab({
  usersData,
  newEmail,
  setNewEmail,
  handleAddUser,
  setEditingUser,
  handleDeleteUser,
  submissions,
  setSelectedSubmission,
  handleDeleteSubmission
}: OverviewTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* User Management */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Manage Users</h3>
            <p className="text-slate-500 text-xs mt-1">Invite and manage roles for ophthalmology educators and students.</p>
          </div>
          <div className="flex gap-2">
            <input 
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="Invite user by email address..."
              className="flex-grow border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <button 
              onClick={handleAddUser}
              className="bg-slate-900 text-white px-6 py-2 rounded-lg font-semibold hover:bg-slate-800 transition text-sm whitespace-nowrap"
            >
              Invite
            </button>
          </div>
        </div>
        <div className="flex-grow overflow-y-auto max-h-[400px]">
          <ul className="divide-y divide-slate-100">
            {usersData.map(u => (
              <li key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800 text-sm">{u.email}</p>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${u.tier === 'pro' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                      {u.tier === 'pro' ? 'Pro' : 'Free'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 capitalize pr-4">
                    Role: <span className={u.role === 'admin' ? 'text-blue-600 font-bold' : ''}>{u.role}</span> | Joined: {u.joined} {u.tierExpiry ? `| Expires: ${u.tierExpiry}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setEditingUser(u)}
                    className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition"
                    title="Edit User"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDeleteUser(u.id)}
                    className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                    title="Remove User"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Review Submissions */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[500px] flex flex-col">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900">Review Submissions</h3>
          <p className="text-slate-500 text-xs mt-1">View student performance graded automatically against the Angoff standard.</p>
        </div>
        <div className="flex-grow overflow-y-auto max-h-[400px]">
          {submissions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm border border-slate-200 border-dashed m-6 rounded-lg">
              <p>No recent submissions.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {submissions.map((sub) => (
                <li key={sub.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer" onClick={() => setSelectedSubmission(sub)}>
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-800 text-sm truncate">{sub.email}</span>
                      <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{sub.exam_type}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Score: <span className="font-bold text-slate-800">{sub.score} / {sub.max_score}</span> | Time: {sub.time_taken}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {new Date(sub.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSubmission(sub.id);
                      }}
                      className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                      title="Delete Submission"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
