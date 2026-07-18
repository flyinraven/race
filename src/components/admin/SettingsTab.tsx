import React, { useState } from 'react';
import { FileText, CheckCircle, Key, Cpu, Eye, EyeOff, Zap, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';

interface SettingsTabProps {
  curriculumText: string;
  setCurriculumText: (val: string) => void;
  handleSaveCurriculum: () => void;
  curriculumSaved: boolean;

  examGuidelines: string;
  setExamGuidelines: (val: string) => void;
  handleSaveGuidelines: () => void;
  guidelinesSaved: boolean;

  aiProvider: string;
  setAiProvider: (val: string) => void;
  aiApiKey: string;
  setAiApiKey: (val: string) => void;
  aiModel: string;
  setAiModel: (val: string) => void;
  saveAiConfig: () => void;
  aiConfigSaved: boolean;

  setCustomGenTopic?: (val: string) => void;
}

const GOOGLE_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — Free tier, recommended' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — Requires billing' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
];

const OPENAI_MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini — Cheaper, fast' },
  { id: 'gpt-4o', label: 'GPT-4o — More capable' },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
];

export default function SettingsTab({
  curriculumText,
  setCurriculumText,
  handleSaveCurriculum,
  curriculumSaved,
  examGuidelines,
  setExamGuidelines,
  handleSaveGuidelines,
  guidelinesSaved,
  aiProvider,
  setAiProvider,
  aiApiKey,
  setAiApiKey,
  aiModel,
  setAiModel,
  saveAiConfig,
  aiConfigSaved,
}: SettingsTabProps) {
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testError, setTestError] = useState('');

  const handleTestConnection = async () => {
    if (!aiApiKey.trim()) {
      setTestStatus('fail');
      setTestError('Please enter an API key first.');
      return;
    }
    setTestStatus('testing');
    setTestError('');
    try {
      saveAiConfig();
      const result = await apiFetch('/ai/generate', {
        method: 'POST',
        body: JSON.stringify({
          parts: [{ text: 'Say "OK" in one word.' }],
          config: { temperature: 0.1 },
          modelOverride: aiModel,
          provider: aiProvider,
          customKey: aiApiKey,
        }),
      });
      if (result?.text) {
        setTestStatus('ok');
      } else {
        setTestStatus('fail');
        setTestError('Connected but received an empty response.');
      }
    } catch (e: any) {
      setTestStatus('fail');
      setTestError(e.message || 'Connection failed.');
    }
  };

  const models = aiProvider === 'google' ? GOOGLE_MODELS : OPENAI_MODELS;

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* ── AI API Configuration ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <Cpu className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="text-lg font-bold text-slate-900">AI API Configuration</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Keys are stored in your browser and sent only when making AI requests.
            </p>
          </div>
        </div>
        <div className="p-6 space-y-6">

          {/* Provider */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">AI Provider</label>
            <div className="flex gap-3">
              {[
                { id: 'google', label: 'Google AI Studio', badge: 'Free tier available' },
                { id: 'openai', label: 'OpenAI', badge: 'Paid' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setAiProvider(p.id);
                    setAiModel(p.id === 'google' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
                  }}
                  className={`flex-1 border rounded-lg px-4 py-3 text-left transition ${
                    aiProvider === p.id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <p className="font-semibold text-sm">{p.label}</p>
                  <p className="text-xs mt-0.5 opacity-70">{p.badge}</p>
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              <span className="flex items-center gap-1.5"><Key className="w-4 h-4" /> API Key</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={aiApiKey}
                onChange={e => setAiApiKey(e.target.value)}
                placeholder={aiProvider === 'google' ? 'AIza...' : 'sk-...'}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none pr-11"
              />
              <button
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {aiProvider === 'google' && (
              <p className="text-xs text-slate-500 mt-1.5">
                Get your free key at{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 underline hover:text-indigo-800"
                >
                  aistudio.google.com
                </a>
              </p>
            )}
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">AI Model</label>
            <select
              value={aiModel}
              onChange={e => setAiModel(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            {aiProvider === 'google' && (
              <p className="text-xs mt-1.5 text-slate-500">
                {aiModel === 'gemini-2.5-flash'
                  ? '✓ Recommended — Generous free tier, fast, high quality.'
                  : aiModel === 'gemini-2.5-pro'
                  ? '⚠️ Free tier quota is 0 for this model. Requires Google Cloud billing.'
                  : ''}
              </p>
            )}
          </div>

          {/* Test result */}
          {testStatus !== 'idle' && (
            <div className={`flex items-start gap-3 px-4 py-3 rounded-lg text-sm ${
              testStatus === 'ok'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : testStatus === 'fail'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-indigo-50 border border-indigo-200 text-indigo-800'
            }`}>
              {testStatus === 'ok' && <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              {testStatus === 'fail' && <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              {testStatus === 'testing' && <Zap className="w-4 h-4 mt-0.5 flex-shrink-0 animate-pulse" />}
              <span>
                {testStatus === 'ok' && 'Connection successful! AI is responding correctly.'}
                {testStatus === 'fail' && (testError || 'Connection failed. Check your key and model.')}
                {testStatus === 'testing' && 'Testing connection...'}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={saveAiConfig}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition text-sm"
            >
              Save API Settings
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
              className="border border-slate-300 text-slate-700 px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-50 transition text-sm disabled:opacity-50 flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
            {aiConfigSaved && (
              <span className="text-sm text-indigo-600 font-medium flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Saved!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Curriculum Framework ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <FileText className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900">Curriculum Framework</h3>
        </div>
        <div className="p-6">
          <p className="text-slate-600 mb-4 text-sm">
            Upload or paste the curriculum framework for the exam. The AI engine will use this to set examination boundaries, verify syllabus matches when generating questions, and evaluate candidates accurately.
          </p>
          <textarea
            className="w-full border border-slate-300 rounded-lg p-4 text-sm h-64 focus:ring-2 focus:ring-indigo-500 outline-none resize-y font-mono"
            placeholder="Paste syllabus, learning objectives, or curriculum boundaries here..."
            value={curriculumText}
            onChange={e => setCurriculumText(e.target.value)}
          />
          <div className="pt-4 flex items-center gap-4">
            <button
              onClick={handleSaveCurriculum}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition text-sm"
            >
              Save Curriculum Guide
            </button>
            {curriculumSaved && (
              <span className="text-sm text-indigo-600 font-medium flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Saved!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Exam Guidelines & Format ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <FileText className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900">Exam Guidelines & Format</h3>
        </div>
        <div className="p-6">
          <p className="text-slate-600 mb-4 text-sm">
            Define the exact format of the exam — timing rules, mark allocations, scoring standards. You can also paste real OSCE station examples here to improve AI question generation quality.
          </p>
          <textarea
            className="w-full border border-slate-300 rounded-lg p-4 text-sm h-64 focus:ring-2 focus:ring-indigo-500 outline-none resize-y font-mono"
            placeholder="Paste exam formatting guidelines, OSCE station examples, or logistical instructions..."
            value={examGuidelines}
            onChange={e => setExamGuidelines(e.target.value)}
          />
          <div className="pt-4 flex items-center gap-4">
            <button
              onClick={handleSaveGuidelines}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition text-sm"
            >
              Save Exam Guidelines
            </button>
            {guidelinesSaved && (
              <span className="text-sm text-indigo-600 font-medium flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Saved!
              </span>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
