import React, { useState } from 'react';
import { BankQuestion, optimizeModelAnswer } from '../services/examEngine';
import { X, Sparkles, Save, Loader2 } from 'lucide-react';

interface EditQuestionModalProps {
  question: BankQuestion;
  onClose: () => void;
  onSave: (q: BankQuestion) => void;
}

export default function EditQuestionModal({ question, onClose, onSave }: EditQuestionModalProps) {
  const [editedQuestion, setEditedQuestion] = useState<BankQuestion>({ ...question, data: JSON.parse(JSON.stringify(question.data)) });
  const [activePromptSubquestionId, setActivePromptSubquestionId] = useState<string | null>(null);
  const [optimizationPrompt, setOptimizationPrompt] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleTopLevelChange = (field: keyof BankQuestion, value: any) => {
    setEditedQuestion(prev => ({ ...prev, [field]: value }));
  };

  const handleSubquestionChange = (id: string, field: string, value: string) => {
    setEditedQuestion(prev => {
      const newData = { ...prev.data };
      if (newData.subQuestions) {
        newData.subQuestions = newData.subQuestions.map((sq: any) => 
          sq.id === id ? { ...sq, [field]: value } : sq
        );
      }
      return { ...prev, data: newData };
    });
  };

  const handleOptimize = async (sq: any) => {
    if (!optimizationPrompt.trim()) return;
    setIsOptimizing(true);
    try {
      const optimizedAnswer = await optimizeModelAnswer(sq.text, sq.modelAnswer || '', optimizationPrompt);
      handleSubquestionChange(sq.id, 'modelAnswer', optimizedAnswer);
      setActivePromptSubquestionId(null);
      setOptimizationPrompt('');
    } catch (err: any) {
      alert(`Optimization failed: ${err.message}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleImagePaste = (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>, onInsert: (markdown: string) => void) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          onInsert(`\n\n![Image](${base64})`);
        };
        reader.readAsDataURL(file);
        e.preventDefault();
        break;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col my-8">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10 rounded-t-xl">
          <h2 className="text-xl font-bold text-slate-800">Edit Question</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Type</label>
              <select 
                value={editedQuestion.type} 
                onChange={e => handleTopLevelChange('type', e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="VSAQ">VSAQ</option>
                <option value="SEQ">SEQ</option>
                <option value="OSCE">OSCE</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Topic</label>
              <select
                value={editedQuestion.topic}
                onChange={e => handleTopLevelChange('topic', e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                {["Cataract", "Cornea and External Eye", "Glaucoma", "Neuro-ophthalmology", "Ocular Inflammation", "Ocular Motility", "Oculoplastics and Orbit", "Paediatrics", "Vitreoretinal"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Year</label>
              <input 
                value={editedQuestion.year || ''} 
                onChange={e => handleTopLevelChange('year', e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. 2023"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Paper/Label</label>
              <input 
                value={editedQuestion.questionLabel || editedQuestion.paper || ''} 
                onChange={e => handleTopLevelChange('questionLabel', e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. Sem 1 Q12"
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-end mb-2">
              <label className="block text-sm font-semibold text-slate-700">Scenario Context</label>
              <div className="relative">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const base64 = event.target?.result as string;
                      const currentScenario = editedQuestion.data.scenario || '';
                      const newScenario = currentScenario + `\n\n![Image](${base64})`;
                      handleTopLevelChange('data', { ...editedQuestion.data, scenario: newScenario });
                    };
                    reader.readAsDataURL(file);
                    e.target.value = ''; // Reset
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Upload an image to attach to this scenario"
                />
                <button className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded font-medium transition cursor-pointer flex items-center gap-1 pointer-events-none">
                  Attach Base64 Image
                </button>
              </div>
            </div>
            <textarea
              value={editedQuestion.data.scenario || ''}
              onChange={e => {
                const newData = { ...editedQuestion.data, scenario: e.target.value };
                handleTopLevelChange('data', newData);
              }}
              onPaste={e => handleImagePaste(e, markdown => {
                const newData = { ...editedQuestion.data, scenario: (editedQuestion.data.scenario || '') + markdown };
                handleTopLevelChange('data', newData);
              })}
              placeholder="Type or paste text/images here..."
              className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-indigo-500 h-32 resize-y font-mono"
            />
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Sub-Questions & Model Answers</h3>
            {editedQuestion.data.subQuestions?.map((sq: any, i: number) => (
              <div key={sq.id || i} className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Question {i + 1}</label>
                  <input
                    value={sq.text || ''}
                    onChange={e => handleSubquestionChange(sq.id, 'text', e.target.value)}
                    onPaste={e => handleImagePaste(e, markdown => handleSubquestionChange(sq.id, 'text', (sq.text || '') + markdown))}
                    placeholder="Type or paste text/images here..."
                    className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-end mb-1">
                    <label className="block text-xs font-semibold text-emerald-600 uppercase">Model Answer</label>
                    <button 
                      onClick={() => setActivePromptSubquestionId(activePromptSubquestionId === sq.id ? null : sq.id)}
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Optimize using AI
                    </button>
                  </div>
                  
                  {activePromptSubquestionId === sq.id && (
                    <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col gap-2">
                      <label className="text-xs font-semibold text-emerald-800">Instructions for AI:</label>
                      <div className="flex gap-2">
                        <input 
                          autoFocus
                          placeholder="e.g. Make it more concise, align with latest guidelines..."
                          value={optimizationPrompt}
                          onChange={e => setOptimizationPrompt(e.target.value)}
                          className="flex-1 text-sm border-emerald-300 rounded px-2 py-1.5 focus:ring-emerald-500 focus:border-emerald-500"
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleOptimize(sq);
                          }}
                        />
                        <button 
                          onClick={() => handleOptimize(sq)}
                          disabled={isOptimizing || !optimizationPrompt.trim()}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm font-medium transition disabled:opacity-50 flex items-center gap-1"
                        >
                          {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Run'}
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    value={sq.modelAnswer || ''}
                    onChange={e => handleSubquestionChange(sq.id, 'modelAnswer', e.target.value)}
                    onPaste={e => handleImagePaste(e, markdown => handleSubquestionChange(sq.id, 'modelAnswer', (sq.modelAnswer || '') + markdown))}
                    placeholder="Type or paste text/images here..."
                    className="w-full border border-emerald-200 rounded p-3 text-sm focus:ring-2 focus:ring-emerald-500 h-32 resize-y font-mono bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl sticky bottom-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 font-medium text-sm text-slate-600 hover:bg-slate-200 rounded transition"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(editedQuestion)}
            className="px-6 py-2 font-medium text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
