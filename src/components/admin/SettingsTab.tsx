import React, { useState, useRef, useEffect } from 'react';
import { FileText, CheckCircle, Key, Cpu, Eye, EyeOff, Zap, AlertCircle, ChevronDown, Trash2, Upload, BookOpen } from 'lucide-react';
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
];

const OPENAI_MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini — Cheaper, fast' },
  { id: 'gpt-4o', label: 'GPT-4o — More capable' },
  { id: 'o1-mini', label: 'o1-mini — Reasoning' },
  { id: 'o1', label: 'o1 — Advanced reasoning' },
];

const ANTHROPIC_MODELS = [
  { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet — Latest state-of-the-art' },
  { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku — Fast' },
  { id: 'claude-3-opus-latest', label: 'Claude 3 Opus' },
];

const DEEPSEEK_MODELS = [
  { id: 'deepseek-chat', label: 'DeepSeek V3 (deepseek-chat) — Highly cost-effective' },
  { id: 'deepseek-reasoner', label: 'DeepSeek R1 (deepseek-reasoner) — Advanced reasoning' },
];

const OPENROUTER_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct' },
  { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (OpenRouter)' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (OpenRouter)' },
  { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B Instruct' },
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
  const [customModelName, setCustomModelName] = useState('');
  const [showCustomModelInput, setShowCustomModelInput] = useState(false);

  // Curriculum Manager State
  const [curriculumDocs, setCurriculumDocs] = useState<CurriculumDoc[]>([]);
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
      const activeModel = showCustomModelInput ? customModelName : aiModel;
      const result = await apiFetch('/ai/generate', {
        method: 'POST',
        body: JSON.stringify({
          parts: [{ text: 'Say "OK" in one word.' }],
          config: { temperature: 0.1 },
          modelOverride: activeModel,
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
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingDoc(true);

    try {
      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        const progressPrefix = `[${fIdx + 1}/${files.length}] `;
        setUploadDocStatus(`${progressPrefix}Reading ${file.name}...`);

        let textContent = '';
        const fileNameLower = file.name.toLowerCase();

        if (fileNameLower.endsWith('.pdf')) {
          setUploadDocStatus(`${progressPrefix}Reading PDF pages...`);
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
            setUploadDocStatus(`${progressPrefix}Extracting page ${pageNum} of ${doc.numPages}...`);
            const page = await doc.getPage(pageNum);
            const text = await page.getTextContent();
            const pageText = text.items.map((item: any) => item.str).join(' ');
            pageTexts.push(pageText);
          }
          textContent = pageTexts.join('\n');
        } else if (fileNameLower.endsWith('.docx')) {
          setUploadDocStatus(`${progressPrefix}Extracting text from Word document via server...`);
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
          setUploadDocStatus(`${progressPrefix}Reading text file...`);
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

        setUploadDocStatus(`${progressPrefix}AI analyzing document to determine target topic and year...`);
        
        const snippet = textContent.slice(0, 4000);
        const parts = [
          `[CURRICULUM_ANALYSIS]
Analyze the following curriculum framework document. Determine which of the 9 core topics it belongs to:
- Cataract
- Cornea and External Eye
- Glaucoma
- Neuro-ophthalmology
- Ocular Inflammation
- Ocular Motility
- Oculoplastics and Orbit
- Paediatrics
- Vitreoretinal

Also determine the publication or revision year of this curriculum document (if not specified, default to "2024").

You must respond ONLY with a raw JSON object matching this structure:
{
  "topic": "Glaucoma",
  "year": "2023"
}

Text snippet:
${snippet}`
        ];

        const activeModel = showCustomModelInput ? customModelName : aiModel;
        const aiResponse = await apiFetch('/ai/generate', {
          method: 'POST',
          body: JSON.stringify({
            parts,
            config: { temperature: 0.1, responseMimeType: "application/json" },
            modelOverride: activeModel,
            provider: aiProvider,
            customKey: aiApiKey
          })
        });

        let topic = TOPICS[0];
        let year = '2024';

        try {
          const parsed = JSON.parse(aiResponse?.text || '{}');
          if (parsed.topic) topic = parsed.topic;
          if (parsed.year) year = String(parsed.year);
        } catch (err) {
          console.warn("AI topic extraction failed, defaulting.", err);
        }

        // Normalize topic string
        const matchedTopic = TOPICS.find(t => t.toLowerCase() === topic.toLowerCase() || topic.toLowerCase().includes(t.toLowerCase()));
        if (matchedTopic) {
          topic = matchedTopic;
        } else {
          topic = TOPICS[0];
        }

        setUploadDocStatus(`${progressPrefix}Saving curriculum document under topic "${topic}" and year ${year}...`);
        await uploadCurriculumDoc({
          topic,
          filename: file.name,
          year,
          text_content: textContent
        });
      }

      setUploadDocStatus(`Successfully uploaded all ${files.length} curriculum documents.`);
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

  const models = 
    aiProvider === 'google' ? GOOGLE_MODELS :
    aiProvider === 'openai' ? OPENAI_MODELS :
    aiProvider === 'anthropic' ? ANTHROPIC_MODELS :
    aiProvider === 'deepseek' ? DEEPSEEK_MODELS :
    OPENROUTER_MODELS;

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* ── AI API Configuration ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <Cpu className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="text-lg font-bold text-slate-900">AI API Configuration</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select your provider, key, and models to power question generation and assessment.
            </p>
          </div>
        </div>
        <div className="p-6 space-y-6">

          {/* Provider */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">AI Provider</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {[
                { id: 'google', label: 'Google', badge: 'Free tier' },
                { id: 'openai', label: 'OpenAI', badge: 'Paid' },
                { id: 'anthropic', label: 'Anthropic', badge: 'Claude' },
                { id: 'deepseek', label: 'DeepSeek', badge: 'Economic' },
                { id: 'openrouter', label: 'OpenRouter', badge: 'Any Model' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setAiProvider(p.id);
                    setAiModel(
                      p.id === 'google' ? 'gemini-2.5-flash' :
                      p.id === 'openai' ? 'gpt-4o-mini' :
                      p.id === 'anthropic' ? 'claude-3-5-sonnet-latest' :
                      p.id === 'deepseek' ? 'deepseek-chat' :
                      'meta-llama/llama-3.3-70b-instruct'
                    );
                    setShowCustomModelInput(false);
                  }}
                  className={`border rounded-lg px-2 py-2 text-left transition ${
                    aiProvider === p.id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <p className="font-semibold text-xs truncate">{p.label}</p>
                  <p className="text-[10px] opacity-75 truncate">{p.badge}</p>
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
                placeholder={
                  aiProvider === 'google' ? 'AIza...' :
                  aiProvider === 'openai' ? 'sk-proj-...' :
                  aiProvider === 'anthropic' ? 'sk-ant-...' :
                  aiProvider === 'deepseek' ? 'sk-...' :
                  'sk-or-...'
                }
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
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">AI Model</label>
            {!showCustomModelInput ? (
              <div className="flex gap-2">
                <select
                  value={aiModel}
                  onChange={e => setAiModel(e.target.value)}
                  className="flex-grow border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCustomModelInput(true)}
                  className="px-3 border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Type Model ID
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customModelName}
                  onChange={e => setCustomModelName(e.target.value)}
                  placeholder="e.g. meta-llama/llama-3.1-405b-instruct"
                  className="flex-grow border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                />
                <button
                  onClick={() => {
                    setShowCustomModelInput(false);
                    setCustomModelName('');
                  }}
                  className="px-3 border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Use List
                </button>
              </div>
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
                      <input
                        type="text"
                        placeholder="Model override (optional)..."
                        value={taskModels[task]}
                        onChange={e => savePerTaskModel(task, e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white min-w-[220px] font-mono"
                      />
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
            <p className="text-xs text-slate-500 mt-0.5">Upload syllabus documents. The AI automatically determines the topic and year from content.</p>
          </div>
        </div>
        <div className="p-6 space-y-6">

          {/* Upload panel */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="relative">
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                onChange={handleDocUpload}
                ref={fileInputRef}
                disabled={isUploadingDoc}
                className={`absolute inset-0 w-full h-full opacity-0 ${isUploadingDoc ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              />
              <div className={`bg-purple-50 border border-purple-200 text-purple-700 w-full py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2 pointer-events-none ${isUploadingDoc ? 'opacity-70' : 'hover:bg-purple-100'}`}>
                {isUploadingDoc ? <Zap className="w-5 h-5 animate-pulse" /> : <Upload className="w-5 h-5" />}
                {isUploadingDoc ? 'Analyzing & extracting curriculum...' : 'Upload Curriculum Reference (PDF, Word, TXT)'}
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
