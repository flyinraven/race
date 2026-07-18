import React, { useState, useRef, useEffect } from 'react';
import { FileText, CheckCircle, Key, Cpu, Eye, EyeOff, Zap, AlertCircle, ChevronDown, Trash2, Upload, Calendar, BookOpen, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import { TASK_MODEL_KEYS, type AiTask, CurriculumDoc, getCurriculumDocs, uploadCurriculumDoc, deleteCurriculumDoc } from '../../services/examEngine';
import * as pdfjsLib from 'pdfjs-dist';

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

const TOPICS = [
  "Cataract", "Cornea and External Eye", "Glaucoma",
  "Neuro-ophthalmology", "Ocular Inflammation", "Ocular Motility",
  "Oculoplastics and Orbit", "Paediatrics", "Vitreoretinal"
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
  const [showPerTask, setShowPerTask] = useState(false);

  // Curriculum Manager State
  const [curriculumDocs, setCurriculumDocs] = useState<CurriculumDoc[]>([]);
  const [uploadTopic, setUploadTopic] = useState(TOPICS[0]);
  const [uploadYear, setUploadYear] = useState(new Date().getFullYear().toString());
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadDocStatus, setUploadDocStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Per-task model state — read from localStorage on mount
  const taskKeys = Object.keys(TASK_MODEL_KEYS) as AiTask[];
  const [taskModels, setTaskModels] = useState<Record<AiTask, string>>(() => {
    return {
      generation:   localStorage.getItem(TASK_MODEL_KEYS.generation)   || '',
      grading:      localStorage.getItem(TASK_MODEL_KEYS.grading)      || '',
      parsing:      localStorage.getItem(TASK_MODEL_KEYS.parsing)      || '',
      optimization: localStorage.getItem(TASK_MODEL_KEYS.optimization) || '',
    };
  });

  const refreshCurriculumDocs = async () => {
    const docs = await getCurriculumDocs();
    setCurriculumDocs(docs);
  };

  useEffect(() => {
    refreshCurriculumDocs();
  }, []);

  const savePerTaskModel = (task: AiTask, model: string) => {
    const updated = { ...taskModels, [task]: model };
    setTaskModels(updated);
    if (model) {
      localStorage.setItem(TASK_MODEL_KEYS[task], model);
    } else {
      localStorage.removeItem(TASK_MODEL_KEYS[task]);
    }
  };

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

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!uploadYear.trim() || !uploadYear.match(/^\d{4}$/)) {
      setUploadDocStatus('Error: Please enter a valid 4-digit year.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploadingDoc(true);
    setUploadDocStatus(`Reading ${file.name}...`);

    try {
      let textContent = '';
      const fileNameLower = file.name.toLowerCase();

      if (fileNameLower.endsWith('.pdf')) {
        setUploadDocStatus('Reading PDF pages...');
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;
        const pdfData = atob(base64.split('base64,').pop() || base64);
        const uint8Array = new Uint8Array(pdfData.length);
        for (let i = 0; i < pdfData.length; i++) {
            uint8Array[i] = pdfData.charCodeAt(i);
        }

        const doc = await pdfjsLib.getDocument({data: uint8Array}).promise;
        const pageTexts: string[] = [];
        for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
          setUploadDocStatus(`Extracting page ${pageNum} of ${doc.numPages}...`);
          const page = await doc.getPage(pageNum);
          const text = await page.getTextContent();
          const pageText = text.items.map((item: any) => item.str).join(' ');
          pageTexts.push(pageText);
        }
        textContent = pageTexts.join('\n');
      } else if (fileNameLower.endsWith('.docx')) {
        setUploadDocStatus('Extracting text from Word document via server...');
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;
        
        const response = await apiFetch('/admin/parse-docx', {
          method: 'POST',
          body: JSON.stringify({ fileDataB64: base64 })
        });
        textContent = response.text;
      } else if (fileNameLower.endsWith('.txt')) {
        setUploadDocStatus('Reading text file...');
        const reader = new FileReader();
        const textPromise = new Promise<string>((resolve, reject) => {
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsText(file);
        });
        textContent = await textPromise;
      } else {
        throw new Error('Unsupported format. Please upload PDF, Word (.docx) or Text (.txt) files.');
      }

      if (!textContent || textContent.trim().length === 0) {
        throw new Error('No text content could be extracted from this document.');
      }

      setUploadDocStatus('Saving curriculum document to database...');
      await uploadCurriculumDoc({
        topic: uploadTopic,
        filename: file.name,
        year: uploadYear,
        text_content: textContent
      });

      setUploadDocStatus(`Successfully uploaded curriculum doc for ${uploadTopic}.`);
      await refreshCurriculumDocs();
    } catch (err: any) {
      setUploadDocStatus(`Error: ${err.message || 'Failed to extract document.'}`);
    } finally {
      setIsUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDocDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the curriculum document "${name}"?`)) return;
    try {
      await deleteCurriculumDoc(id);
      await refreshCurriculumDocs();
    } catch (err: any) {
      alert(`Error deleting: ${err.message}`);
    }
  };

  const TASK_LABELS: Record<AiTask, { label: string; description: string }> = {
    generation:   { label: 'Question Generation', description: 'Batch/custom question creation and single exam questions' },
    grading:      { label: 'Answer Grading & Assessment', description: 'Marking candidate answers and producing rubric feedback' },
    parsing:      { label: 'PDF / Past Paper Parsing', description: 'Extracting questions from uploaded past exam PDFs' },
    optimization: { label: 'Model Answer Optimization', description: 'Rewriting and improving model answers in the question bank' },
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

          {/* Per-task model overrides */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowPerTask(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <span>Per-task model overrides <span className="font-normal text-slate-500">(optional)</span></span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showPerTask ? 'rotate-180' : ''}`} />
            </button>
            {showPerTask && (
              <div className="border-t border-slate-200 divide-y divide-slate-100">
                <p className="px-4 py-3 text-xs text-slate-500 bg-slate-50">
                  Leave a field set to <strong>Global default</strong> to use the model selected above. Set a specific model to override it for that task only.
                </p>
                {taskKeys.map(task => (
                  <div key={task} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{TASK_LABELS[task].label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{TASK_LABELS[task].description}</p>
                      </div>
                      <select
                        value={taskModels[task]}
                        onChange={e => savePerTaskModel(task, e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white min-w-[220px]"
                      >
                        <option value="">— Global default ({aiModel}) —</option>
                        {models.map(m => (
                          <option key={m.id} value={m.id}>{m.id}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
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

      {/* ── Topic-Based Curriculum Manager ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-purple-600" />
          <div>
            <h3 className="text-lg font-bold text-slate-900">Clinical Curriculum Manager</h3>
            <p className="text-xs text-slate-500 mt-0.5">Upload syllabus documents per topic to restrict AI clinical examination boundaries.</p>
          </div>
        </div>
        <div className="p-6 space-y-6">

          {/* Upload panel */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-purple-600" />
              Upload Curriculum Reference
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Target Topic</label>
                <select
                  value={uploadTopic}
                  onChange={e => setUploadTopic(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-sm bg-white focus:ring-1 focus:ring-purple-500"
                >
                  {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Written Year</label>
                <div className="relative">
                  <input
                    type="number"
                    value={uploadYear}
                    onChange={e => setUploadYear(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500 pl-8 font-mono"
                    placeholder="e.g. 2025"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            <div className="relative">
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleDocUpload}
                ref={fileInputRef}
                disabled={isUploadingDoc}
                className={`absolute inset-0 w-full h-full opacity-0 ${isUploadingDoc ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              />
              <div className={`bg-purple-50 border border-purple-200 text-purple-700 w-full py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 pointer-events-none ${isUploadingDoc ? 'opacity-70' : 'hover:bg-purple-100'}`}>
                {isUploadingDoc ? <Zap className="w-5 h-5 animate-pulse" /> : <Upload className="w-5 h-5" />}
                {isUploadingDoc ? 'Extracting document text...' : 'Select Document (PDF, Word, TXT)'}
              </div>
            </div>
            {uploadDocStatus && (
              <p className={`text-xs mt-2 font-medium ${uploadDocStatus.includes('Error') ? 'text-red-600' : 'text-purple-700 animate-pulse'}`}>
                {uploadDocStatus}
              </p>
            )}
          </div>

          {/* Active Documents List */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Active Curriculum Documents</label>
            {curriculumDocs.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">No uploaded curriculum files. Default system guidelines will be used.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white divide-y divide-slate-100">
                {curriculumDocs.map(d => (
                  <div key={d.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{d.topic}</span>
                        <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded">
                          Year {d.year}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate" title={d.filename}>{d.filename}</p>
                    </div>
                    <button
                      onClick={() => handleDocDelete(d.id, d.filename)}
                      className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                      title="Delete document"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Legacy Curriculum Fallback ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <FileText className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900">Global Curriculum Fallback (Manual Paste)</h3>
        </div>
        <div className="p-6">
          <p className="text-slate-600 mb-4 text-sm leading-relaxed">
            This serves as a backup global text framework. If no specific topic files are uploaded above, this guide will be used by the AI engine as a backup boundary.
          </p>
          <textarea
            className="w-full border border-slate-300 rounded-lg p-4 text-sm h-32 focus:ring-2 focus:ring-indigo-500 outline-none resize-y font-mono text-xs"
            placeholder="Paste syllabus, learning objectives, or curriculum boundaries here..."
            value={curriculumText}
            onChange={e => setCurriculumText(e.target.value)}
          />
          <div className="pt-4 flex items-center gap-4">
            <button
              onClick={handleSaveCurriculum}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition text-sm"
            >
              Save Fallback Text
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
