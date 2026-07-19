import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, FileText, Settings, PlayCircle, Filter } from 'lucide-react';
import { getBank } from '../services/examEngine';

export default function Dashboard() {
  const { user, role, signOut, tier } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'past' | 'generate'>('past');

  // Past Exam State
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);

  const [selectedPastYear, setSelectedPastYear] = useState('All');
  const [selectedPastPaper, setSelectedPastPaper] = useState('All');
  const [selectedPastType, setSelectedPastType] = useState('All');
  const [selectedPastTopic, setSelectedPastTopic] = useState('All');

  const pastYearOptions = useMemo(() => {
    const years = new Set<string>();
    bankQuestions.forEach(q => {
      if (q.year) years.add(String(q.year));
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
  }, [bankQuestions]);

  const pastPaperOptions = useMemo(() => {
    const papers = new Set<string>();
    bankQuestions.forEach(q => {
      if (q.paper) papers.add(q.paper);
    });
    return Array.from(papers).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
  }, [bankQuestions]);

  const pastTypeOptions = useMemo(() => {
    const types = new Set<string>();
    bankQuestions.forEach(q => {
      if (q.type) types.add(q.type);
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
  }, [bankQuestions]);

  const pastTopicOptions = useMemo(() => {
    const topics = new Set<string>();
    bankQuestions.forEach(q => {
      if (q.topic) topics.add(q.topic);
    });
    return Array.from(topics).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
  }, [bankQuestions]);

  // Removed problematic interdependent useEffects that caused maximum update depth exceeded errors

  // Generate Paper State
  const [genMode, setGenMode] = useState<'custom' | 'sim_paper1' | 'sim_paper2' | 'sim_paper3' | 'sim_paper4' | 'sim_osce' | 'sim_full'>('custom');
  const [genTopic, setGenTopic] = useState('combined');
  const [genTypes, setGenTypes] = useState<string[]>(['VSAQ']);
  const [genCount, setGenCount] = useState<number>(10);

  useEffect(() => {
    // Load available past papers from bank
    getBank().then(bank => {
      setBankQuestions(bank);
    });
  }, []);

  const handleStartExam = () => {
    if (mode === 'past') {
      const config = {
        y: selectedPastYear,
        p: selectedPastPaper,
        t: selectedPastType,
        tpc: selectedPastTopic
      };
      const examId = `realpastb64_${btoa(JSON.stringify(config))}`;
      navigate(`/exam/${examId}`);
    } else {
      if (genMode !== 'custom') {
        navigate(`/exam/${genMode}`);
        return;
      }
      const typesStr = genTypes.join('-');
      const examId = `gen_${genTopic}_${typesStr}_${genCount}`;
      navigate(`/exam/${examId}`);
    }
  };

  const toggleGenType = (type: string) => {
    setGenTypes(prev => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev; // Keep at least one selected
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-900">Student Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 mr-4 text-sm font-medium text-slate-500">
            {role === 'admin' && (
              <Link to="/admin" className="text-blue-600 hover:text-blue-800 transition font-bold mr-2">Admin Area</Link>
            )}
            <Link to="/privacy" className="hover:text-slate-900 transition">Privacy</Link>
            <Link to="/terms" className="hover:text-slate-900 transition">Terms</Link>
            <Link to="/billing" className="hover:text-slate-900 transition">Billing</Link>
          </div>
          <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition cursor-pointer">
            <span className="text-slate-600 font-medium underline underline-offset-4 decoration-slate-300">{user?.email}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${tier === 'pro' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
              {tier === 'pro' ? 'Pro' : 'Free'}
            </span>
          </Link>
          <button 
            onClick={() => { signOut(); navigate('/'); }}
            className="flex items-center gap-2 text-slate-500 hover:text-red-600 transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          
          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Select a Past Exam
              </h2>
              <p className="text-slate-500">
                Choose a previously administered exam to test your knowledge.
              </p>
            </div>

            {mode === 'past' ? (
              <div className="space-y-6">
                {bankQuestions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Year</label>
                      <select 
                        value={selectedPastYear}
                        onChange={(e) => setSelectedPastYear(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="All">All Years</option>
                        {pastYearOptions.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Semester / Paper</label>
                      <select 
                        value={selectedPastPaper}
                        onChange={(e) => setSelectedPastPaper(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="All">All Semesters</option>
                        {pastPaperOptions.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Exam Type</label>
                      <select 
                        value={selectedPastType}
                        onChange={(e) => setSelectedPastType(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="All">All Types</option>
                        {pastTypeOptions.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Topic</label>
                      <select 
                        value={selectedPastTopic}
                        onChange={(e) => setSelectedPastTopic(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="All">All Topics</option>
                        {pastTopicOptions.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 italic p-4 bg-slate-50 rounded border border-slate-200">
                    No past papers available in the question bank. Please ask an administrator to upload PDF exam papers.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Simulation Preset</label>
                  <select 
                    value={genMode}
                    onChange={(e) => setGenMode(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="custom">Custom Practice by Topic</option>
                    <option value="sim_paper1">Full Simulation: Paper 1  (15 VSAQ, 5 SEQ)</option>
                    <option value="sim_paper2">Full Simulation: Paper 2  (15 VSAQ, 4 SEQ)</option>
                    <option value="sim_paper3">Full Simulation: Paper 3  (15 VSAQ, 5 SEQ)</option>
                    <option value="sim_paper4">Full Simulation: Paper 4  (15 VSAQ, 4 SEQ)</option>
                    <option value="sim_osce">Full Simulation: OSCE (18 Stations)</option>
                    <option value="sim_full">Full Simulation: Complete Exam (Papers 1-4 + OSCE)</option>
                  </select>
                </div>
                
                {genMode === 'custom' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Topic</label>
                      <select 
                        value={genTopic}
                        onChange={(e) => setGenTopic(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="combined">Combined / Balanced (All Topics)</option>
                        <option value="Cornea and External Eye">Cornea and External Eye</option>
                        <option value="Glaucoma">Glaucoma</option>
                        <option value="Neuro-ophthalmology">Neuro-ophthalmology</option>
                        <option value="Ocular Inflammation">Ocular Inflammation</option>
                        <option value="Ocular Motility">Ocular Motility</option>
                        <option value="Oculoplastics and Orbit">Oculoplastics and Orbit</option>
                        <option value="Ophthalmic Trauma">Ophthalmic Trauma</option>
                        <option value="Refractive Surgery">Refractive Surgery</option>
                        <option value="Vitreoretinal">Vitreoretinal</option>
                        <option value="Paediatrics">Paediatrics</option>
                        <option value="BOOKMARKED">⭐ Marked For Repeat</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Filter className="w-4 h-4 text-slate-500" />
                        <label className="block text-sm font-medium text-slate-700">Question Types</label>
                      </div>
                  <div className="flex flex-wrap gap-3">
                    {['VSAQ', 'SEQ', 'OSCE'].map((type) => (
                      <button
                        key={type}
                        onClick={() => toggleGenType(type)}
                        className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                          genTypes.includes(type)
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Number of Questions ({genCount})
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="50" 
                    value={genCount}
                    onChange={(e) => setGenCount(parseInt(e.target.value))}
                    className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-2">
                    <span>1</span>
                    <span>25</span>
                    <span>50</span>
                  </div>
                </div>
                </>
                )}
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end">
              {mode === 'generate' && tier !== 'pro' ? (
                <button
                  onClick={() => navigate('/pricing')}
                  className="flex items-center gap-2 bg-amber-500 text-white px-8 py-3 rounded-lg font-medium hover:bg-amber-600 transition shadow-sm"
                >
                  <PlayCircle className="w-5 h-5" />
                  Upgrade to Pro to Generate
                </button>
              ) : (
                <button
                  onClick={handleStartExam}
                  className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-lg font-medium hover:bg-slate-800 transition shadow-sm"
                >
                  <PlayCircle className="w-5 h-5" />
                  Start Exam
                </button>
              )}
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
