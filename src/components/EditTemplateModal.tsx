import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { EmailTemplate } from '../services/notificationService';

interface EditTemplateModalProps {
  template: EmailTemplate;
  onClose: () => void;
  onSave: (template: EmailTemplate) => Promise<void>;
}

export default function EditTemplateModal({ template, onClose, onSave }: EditTemplateModalProps) {
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [enabled, setEnabled] = useState(template.enabled);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...template,
        name,
        subject,
        body,
        enabled
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Edit Template: {template.id}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-grow space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Display Name</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Subject</label>
            <input 
              value={subject} 
              onChange={e => setSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center justify-between">
              Body Text
              <span className="text-xs font-normal text-slate-500">Supports {'{{userEmail}}'} etc.</span>
            </label>
            <textarea 
              value={body} 
              onChange={e => setBody(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[200px]"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={enabled} 
              onChange={e => setEnabled(e.target.checked)}
              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-slate-800">Enable this notification</span>
          </label>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg font-medium text-slate-600 hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
