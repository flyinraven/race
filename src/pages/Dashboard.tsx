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

  const simulations = [
    {
      id: 'sim_osce',
      title: 'OSCE Station Simulation',
      description: '9 clinical OSCE stations (one from each curriculum topic) with a 2-minute rest interval between stations.',
      details: '9 Stations | 9 Minutes Per Station | 2 Min Rests',
      badge: 'Highly Recommended',
      badgeColor: 'bg-indigo-100 text-indigo-800'
    },
    {
      id: 'sim_paper1',
      title: 'Paper 1 Simulation',
      description: 'Standard written exam containing 15 Visual Single Answer Questions (VSAQs) and 5 Short Essay Questions (SEQs).',
      details: '20 Questions | 1h 37.5m Total Time',
      badge: 'Day 1 Morning',
      badgeColor: 'bg-blue-100 text-blue-800'
    },
    {
      id: 'sim_paper2',
      title: 'Paper 2 Simulation',
      description: 'Standard written exam containing 15 Visual Single Answer Questions (VSAQs) and 4 Short Essay Questions (SEQs).',
      details: '19 Questions | 1h 22.5m Total Time',
      badge: 'Day 1 Afternoon',
      badgeColor: 'bg-blue-100 text-blue-800'
    },
    {
      id: 'sim_paper3',
      title: 'Paper 3 Simulation',
      description: 'Standard written exam containing 15 Visual Single Answer Questions (VSAQs) and 5 Short Essay Questions (SEQs).',
      details: '20 Questions | 1h 37.5m Total Time',
      badge: 'Day 2 Morning',
      badgeColor: 'bg-blue-100 text-blue-800'
    },
    {
      id: 'sim_paper4',
      title: 'Paper 4 Simulation',
      description: 'Standard written exam containing 15 Visual Single Answer Questions (VSAQs) and 4 Short Essay Questions (SEQs).',
      details: '19 Questions | 1h 22.5m Total Time',
      badge: 'Day 2 Afternoon',
      badgeColor: 'bg-blue-100 text-blue-800'
    }
  ];

  const handleStartExam = (presetMode?: string) => {
    if (presetMode) {
      navigate(`/exam/${presetMode}`);
      return;
    }
    const typesStr = genTypes.join('-');
    const examId = `gen_${genTopic}_${typesStr}_${genCount}`;
    navigate(`/exam/${examId}`);
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
          
          {/* Mode Selector - Only visible to Pro Users */}
          {tier === 'pro' && (
            <div className="flex border-b border-slate-200 bg-slate-50/50">
              <button
                onClick={() => setMode('past')}
                className={`flex-1 py-4 flex items-center justify-center gap-2 font-semibold text-sm transition-colors ${
                  mode === 'past' 
                    ? 'bg-white text-blue-700 border-b-2 border-blue-600' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-5 h-5" />
                Exam Style Practice
              </button>
              <button
                onClick={() => setMode('generate')}
                className={`flex-1 py-4 flex items-center justify-center gap-2 font-semibold text-sm transition-colors ${
                  mode === 'generate' 
                    ? 'bg-white text-blue-700 border-b-2 border-blue-600' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Settings className="w-5 h-5" />
                Topic-Based Practice
              </button>
            </div>
          )}

          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {mode === 'past' ? 'Exam Style Practice' : 'Topic-Based Custom Practice'}
              </h2>
              <p className="text-slate-500">
                {mode === 'past' 
                  ? 'Standard simulation papers matching official RANZCO formats.' 
                  : 'Customize your practice by topic, question types, and counts.'}
              </p>
            </div>

            {mode === 'past' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  {simulations.map((sim) => (
                    <div 
                      key={sim.id}
                      className="border border-slate-200 hover:border-blue-400 rounded-xl p-6 transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md cursor-pointer bg-slate-50/20"
                      onClick={() => handleStartExam(sim.id)}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-800 text-lg">{sim.title}</h3>
                          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${sim.badgeColor}`}>
                            {sim.badge}
                          </span>
                        </div>
                        <p className="text-slate-500 text-sm max-w-xl">{sim.description}</p>
                        <span className="text-xs text-slate-400 font-mono block">{sim.details}</span>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartExam(sim.id);
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition flex items-center gap-1.5 shadow-sm"
                      >
                        <PlayCircle className="w-4 h-4" /> Start Exam
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Topic</label>
                  <select 
                    value={genTopic}
                    onChange={(e) => setGenTopic(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="mixed">Mixed (Equal Spread of Topics)</option>
                    <option value="Cataract">Cataract</option>
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
                    Number of Questions
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="100" 
                    value={genCount}
                    onChange={(e) => setGenCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full sm:w-32 border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-semibold text-slate-800"
                  />
                </div>

                <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => handleStartExam()}
                    className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-lg font-medium hover:bg-slate-800 transition shadow-sm"
                  >
                    <PlayCircle className="w-5 h-5" />
                    Start Custom Practice
                  </button>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}
