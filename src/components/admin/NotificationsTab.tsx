import React from 'react';
import { Mail, Edit2 } from 'lucide-react';

interface NotificationsTabProps {
  emailTemplates: any[];
  setEditingTemplate: (template: any) => void;
}

export default function NotificationsTab({
  emailTemplates,
  setEditingTemplate
}: NotificationsTabProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-900">Email Templates</h3>
          </div>
        </div>
        <div className="p-6">
          <p className="text-slate-600 mb-6 text-sm">
            Manage automated email notifications sent to users on key events. You can enable/disable these and modify their subject and body text. Use {'{{variable}}'} tags to inject dynamic content.
          </p>
          <div className="space-y-4">
            {emailTemplates.map(template => (
              <div key={template.id} className="border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row justify-between gap-4 bg-slate-50 hover:bg-slate-100/50 transition">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-bold text-slate-800">{template.name}</h4>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${template.enabled ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}>
                      {template.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-500 mb-2">ID: {template.id}</p>
                  <p className="text-sm text-slate-700"><span className="font-medium">Subject:</span> {template.subject}</p>
                </div>
                <div className="flex items-end sm:items-center">
                  <button 
                    onClick={() => setEditingTemplate(template)}
                    className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium transition text-sm flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
