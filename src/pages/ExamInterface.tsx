import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Clock, AlertCircle, FileUp, Loader2, ArrowRight, ArrowLeft, CheckCircle2, X, Pause, Play, BookOpen, Bookmark } from 'lucide-react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import { generateSingleQuestion, gradeAnswerMode, getBank, isBookmarked, toggleBookmark } from '../services/examEngine';
import { submitExam } from '../services/userService';

type QuestionSpec = {
  type: string;
  topic: string;
  timeLimitSec: number;
  label?: string;
  bankId?: string; // If this question directly maps to a specific bank item
};

type QuestionData = {
  scenario: string;
  subQuestions: { id: string; text: string }[];
  error?: string;
};

const ImageModal = ({ src, alt, onClose }: { src: string, alt: string, onClose: () => void }) => {
  if (!src) return null;
  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm shadow-2xl" onClick={onClose}>
    <button onClick={onClose} className="absolute top-6 right-6 p-2 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition">
      <X className="w-8 h-8" />
    </button>
    <img 
      src={src} 
      alt={alt} 
      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
      onClick={e => e.stopPropagation()} 
      referrerPolicy="no-referrer"
      onError={(e) => {
        const target = e.currentTarget as HTMLImageElement;
        target.onerror = null;
        target.src = 'https://placehold.co/800x600/png?text=Image+Not+Available';
      }}
    />
  </div>
  );
};

const TOPICS = [
  "Cataract", "Cornea and External Eye", "Glaucoma",
  "Neuro-ophthalmology", "Ocular Inflammation", "Ocular Motility",
  "Oculoplastics and Orbit", "Paediatrics", "Vitreoretinal"
];

function buildExamPlan(examId: string, bankItems?: any[]): QuestionSpec[] {
  const plan: QuestionSpec[] = [];
  if (examId.startsWith('realpastb64_')) {
    let config: any = {};
    try {
      config = JSON.parse(atob(examId.substring('realpastb64_'.length)));
    } catch(e) {}
    
    if (bankItems && bankItems.length > 0) {
      const paperQuestions = bankItems.filter(q => {
        if (config.y && config.y !== 'All' && String(q.year) !== config.y) return false;
        if (config.p && config.p !== 'All' && q.paper !== config.p && q.questionLabel !== config.p) return false;
        if (config.t && config.t !== 'All' && q.type !== config.t) return false;
        if (config.tpc && config.tpc !== 'All' && q.topic !== config.tpc) return false;
        return true;
      });
      
      const getNum = (str: string) => {
        const match = str?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      
      paperQuestions.sort((a, b) => getNum(a.questionLabel) - getNum(b.questionLabel));
      
      paperQuestions.forEach((q, i) => {
        const timeLimitSec = q.type === 'VSAQ' ? 90 : q.type === 'SEQ' ? 15 * 60 : 9 * 60;
        plan.push({
          type: q.type,
          topic: q.topic,
          timeLimitSec,
          label: q.questionLabel || `Question ${i + 1} (${q.type})`,
          bankId: q.id
        });
      });
    }
  } else if (examId.startsWith('realpast_')) {
    const paperName = decodeURIComponent(examId.substring('realpast_'.length));
    
    // We should have passed bankItems to buildExamPlan
    if (bankItems && bankItems.length > 0) {
      const paperQuestions = bankItems.filter(q => q.paper === paperName || q.questionLabel === paperName);
      
      const getNum = (str: string) => {
        const match = str?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      
      paperQuestions.sort((a, b) => getNum(a.questionLabel) - getNum(b.questionLabel));
      
      paperQuestions.forEach((q, i) => {
        const timeLimitSec = q.type === 'VSAQ' ? 90 : q.type === 'SEQ' ? 15 * 60 : 9 * 60;
        plan.push({
          type: q.type,
          topic: q.topic,
          timeLimitSec,
          label: q.questionLabel || `Question ${i + 1} (${q.type})`,
          bankId: q.id
        });
      });
    }
    
    // If no bank items provided or none found, we might show empty plan temporarily
  } else if (examId.startsWith('past_')) {
    const parts = examId.split('_'); 
    const day = parts[2];
    const paper = parts[3];
    
    // 15 VSAQ covering all 9 topics evenly
    for (let i = 0; i < 15; i++) {
       plan.push({
         type: 'VSAQ',
         topic: TOPICS[i % 9],
         timeLimitSec: 90,
         label: `Question ${i + 1} (VSAQ)`
       });
    }

    let seqCount = 0;
    let seqStart = 1;
    if (day === 'day1' && paper === 'paper1') { seqCount = 5; seqStart = 1; }
    else if (day === 'day1' && paper === 'paper2') { seqCount = 4; seqStart = 6; }
    else if (day === 'day2' && paper === 'paper1') { seqCount = 5; seqStart = 10; }
    else if (day === 'day2' && paper === 'paper2') { seqCount = 4; seqStart = 15; }

    for (let i = 0; i < seqCount; i++) {
       plan.push({
         type: 'SEQ',
         topic: 'combined', 
         timeLimitSec: 15 * 60,
         label: `Question ${seqStart + i} (SEQ)`
       });
    }
  } else if (examId.startsWith('sim_')) {
    const simType = examId.split('_')[1];
    
    if (simType === 'full') {
      const papers = ['paper1', 'paper2', 'paper3', 'paper4'];
      for (const p of papers) {
        for (let i = 0; i < 15; i++) {
          plan.push({ type: 'VSAQ', topic: TOPICS[(i + (p === 'paper3' || p === 'paper4' ? 4 : 0)) % 9], timeLimitSec: 90, label: `${p} Q${i + 1} (VSAQ)` });
        }
        const seqCount = (p === 'paper2' || p === 'paper4') ? 4 : 5;
        for (let i = 0; i < seqCount; i++) {
          plan.push({ type: 'SEQ', topic: TOPICS[(i + 3 + (p === 'paper3' || p === 'paper4' ? 4 : 0)) % 9], timeLimitSec: 15 * 60, label: `${p} Q${16 + i} (SEQ)` });
        }
      }
      for (let i = 0; i < 18; i++) {
        plan.push({ type: 'OSCE', topic: TOPICS[i % 9], timeLimitSec: 9 * 60, label: `OSCE Station ${i + 1}` });
      }
    } else if (simType.startsWith('paper')) {
      for (let i = 0; i < 15; i++) {
         plan.push({
           type: 'VSAQ',
           topic: TOPICS[i % 9],
           timeLimitSec: 90, // 1.5 mins
           label: `Question ${i + 1} (VSAQ)`
         });
      }
      const seqCount = (simType === 'paper2' || simType === 'paper4') ? 4 : 5;
      for (let i = 0; i < seqCount; i++) {
         plan.push({
           type: 'SEQ',
           topic: TOPICS[(i + 3) % 9], 
           timeLimitSec: 15 * 60, // 15 mins
           label: `Question ${16 + i} (SEQ)`
         });
      }
    } else if (simType === 'osce') {
      for (let i = 0; i < 18; i++) {
         plan.push({
           type: 'OSCE',
           topic: TOPICS[i % 9], 
           timeLimitSec: 9 * 60,
           label: `Station ${i + 1} (OSCE)`
         });
      }
    }
  } else if (examId.startsWith('gen_')) {
    const parts = examId.split('_');
    const topic = parts[1];
    const typesStr = parts[2] || 'VSAQ';
    const count = parseInt(parts[3] || '10', 10);
    const types = typesStr.split('-');
    
    if (topic === 'BOOKMARKED') {
      const getBookmarks = () => {
        try { return JSON.parse(localStorage.getItem('ranzco_bookmarks') || '[]'); } catch (e) { return []; }
      };
      const bookmarks = getBookmarks();
      
      if (bankItems && bankItems.length > 0) {
        const bookmarkedQuestions = bankItems.filter(q => bookmarks.includes(q.id));
        bookmarkedQuestions.sort(() => Math.random() - 0.5); // shuffle
        
        const selected = bookmarkedQuestions.slice(0, count);
        selected.forEach((q, i) => {
          const timeLimitSec = q.type === 'VSAQ' ? 90 : q.type === 'SEQ' ? 15 * 60 : 9 * 60;
          plan.push({
            type: q.type,
            topic: q.topic,
            timeLimitSec,
            label: q.questionLabel || `Bookmarked Q${i + 1} (${q.type})`,
            bankId: q.id
          });
        });
      }
      // If none bookmarked, let it be zero
    } else {
      for (let i = 0; i < count; i++) {
        const type = types[i % types.length];
        const timeLimitSec = type === 'VSAQ' ? 90 : type === 'SEQ' ? 15 * 60 : 9 * 60;
        const actualTopic = topic === 'combined' ? TOPICS[i % TOPICS.length] : topic;
        plan.push({
          type,
          topic: actualTopic,
          timeLimitSec,
          label: `Question ${i + 1} (${type})`
        });
      }
    }
  }
  return plan;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function ExamInterface() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { tier } = useAuth();
  
  const [plan, setPlan] = useState<QuestionSpec[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Cache for generated questions
  const [questionsCache, setQuestionsCache] = useState<Record<number, QuestionData>>({});
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true);
  
  // Global remaining time (sum of all questions)
  const [totalTimeRemaining, setTotalTimeRemaining] = useState(0);
  // Time spent per question
  const [timeSpent, setTimeSpent] = useState<Record<number, number>>({});
  
  // Answers tracking
  const [answers, setAnswers] = useState<Record<number, Record<string, string>>>({});
  const [pdfFiles, setPdfFiles] = useState<Record<number, {file: File, base64: string}>>({});
  
  const [isExamFinished, setIsExamFinished] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [gradingResults, setGradingResults] = useState<Record<number, string>>({});

  const [examPhase, setExamPhase] = useState<'reading' | 'writing'>('writing');
  const [readingTimeRemaining, setReadingTimeRemaining] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isFullPaper, setIsFullPaper] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  
  useEffect(() => {
    try { setBookmarks(JSON.parse(localStorage.getItem('ranzco_bookmarks') || '[]')); } catch (e) {}
  }, []);

  const handleToggleBookmark = () => {
    const spec = plan[currentIndex];
    if (spec.bankId) {
      toggleBookmark(spec.bankId);
      try { setBookmarks(JSON.parse(localStorage.getItem('ranzco_bookmarks') || '[]')); } catch (e) {}
    } else {
      alert('This is a generated question and cannot be bookmarked. Please select questions from the bank.');
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bankItemsState, setBankItemsState] = useState<any[]>([]);
  const [bankLoaded, setBankLoaded] = useState(false);

  useEffect(() => {
    getBank().then(bank => {
      setBankItemsState(bank);
      setBankLoaded(true);
      if (examId) {
        const generatedPlan = buildExamPlan(examId, bank);
        setPlan(generatedPlan);
        setCurrentIndex(0);
        setTotalTimeRemaining(generatedPlan.reduce((acc, q) => acc + q.timeLimitSec, 0));
        
        let fullPaperMode = false;
        
        if (examId.startsWith('sim_paper') || examId === 'sim_full') fullPaperMode = true;
        if (examId.startsWith('realpastb64_')) {
           try {
             const config = JSON.parse(atob(examId.substring('realpastb64_'.length)));
             if ((config.p === 'Paper 1' || config.p === 'Paper 2') && config.t === 'All' && (!config.tpc || config.tpc === 'All')) {
                fullPaperMode = true;
             }
           } catch(e) {}
        }
        
        setIsFullPaper(fullPaperMode);
        
        if (fullPaperMode) {
           setExamPhase('reading');
           setReadingTimeRemaining(15 * 60); // 15 minutes reading time
        } else {
           setExamPhase('writing');
        }
      }
    });
  }, [examId]);

  useEffect(() => {
    if (plan.length > 0 && !isExamFinished) {
      loadQuestion(currentIndex);
    }
  }, [currentIndex, plan, isExamFinished]);

  // Background Preloader
  useEffect(() => {
    if (plan.length > 0 && !isExamFinished) {
      const nextUnloadedIdx = plan.findIndex((_, idx) => !questionsCache[idx]);
      if (nextUnloadedIdx !== -1 && nextUnloadedIdx !== currentIndex && !isLoadingQuestion) {
        const timer = setTimeout(() => {
           loadQuestion(nextUnloadedIdx, true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [questionsCache, plan, currentIndex, isExamFinished, isLoadingQuestion]);

  const [zoomedImage, setZoomedImage] = useState<{src: string, alt: string} | null>(null);

  const customUrlTransform = (value: string) => {
    if (value.startsWith('data:image/')) return value;
    if (value.startsWith('SEARCH_IMAGE:')) {
      const query = value.replace('SEARCH_IMAGE:', '').replace(/\+/g, ' ');
      return 'https://placehold.co/600x400/eeeeee/888888.png?text=' + encodeURIComponent(query);
    }
    return defaultUrlTransform(value);
  };

  const MarkdownComponents = {
  img: ({ node, ...props }: any) => {
    if (!props.src) return null;
    let proxySrc = props.src;
    if (proxySrc.includes('wikimedia.org')) {
        proxySrc = '/api/image-proxy?url=' + encodeURIComponent(proxySrc);
    } else if (proxySrc.includes('placehold.co') && proxySrc.includes('text=')) {
        // Attempt dynamic fallback fetch from the backend proxy
        const match = proxySrc.match(/text=([^&]+)/);
        if (match && match[1]) {
           let extractedQuery = decodeURIComponent(match[1]).replace(/\+/g, ' ');
           proxySrc = '/api/image-search-proxy?q=' + encodeURIComponent(extractedQuery);
        }
    }
      return (
      <img
        alt={props.alt || 'Image'} src={proxySrc}
        referrerPolicy="no-referrer"
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement;
          target.onerror = null;
          target.src = 'https://placehold.co/600x400/png?text=Image+Not+Available';
        }}
        className="max-w-full h-auto rounded-lg shadow-sm border border-slate-200 my-4 cursor-zoom-in hover:opacity-90 transition-opacity"
        onClick={() => setZoomedImage({ src: props.src, alt: props.alt || 'Enlarged image' })}
      />
  )}
  };

  const loadQuestion = async (index: number, isPreload = false) => {
    if (questionsCache[index]) {
      if (!isPreload) setIsLoadingQuestion(false);
      return;
    }
    
    if (!isPreload) setIsLoadingQuestion(true);
    const spec = plan[index];

    if (spec.bankId && bankItemsState.length > 0) {
      const bItem = bankItemsState.find(q => q.id === spec.bankId);
      if (bItem && bItem.data) {
        setQuestionsCache(prev => ({...prev, [index]: bItem.data}));
        if (!isPreload) setIsLoadingQuestion(false);
        return;
      }
    }

    try {
      if (!navigator.onLine) {
        setQuestionsCache(prev => ({...prev, [index]: { scenario: "**Offline Info:** You are currently offline and cannot generate new questions using AI. Please connect to the internet or skip this question.", subQuestions: [] }}));
        if (!isPreload) setIsLoadingQuestion(false);
        return;
      }
      if (tier !== 'pro') {
        setQuestionsCache(prev => ({...prev, [index]: { scenario: "**Premium Feature:** Generating new questions requires a Pro subscription. [Click here to upgrade](/pricing)", subQuestions: [] }}));
        if (!isPreload) setIsLoadingQuestion(false);
        return;
      }
      const data = await generateSingleQuestion(spec.type, spec.topic);
      if (data && data.scenario && Array.isArray(data.subQuestions)) {
        setQuestionsCache(prev => ({...prev, [index]: data}));
      } else {
         setQuestionsCache(prev => ({...prev, [index]: { scenario: "**Error:** Could not parse AI response. Please try skipping the question.", subQuestions: [] }}));
      }
    } catch (err) {
      console.error(err);
      setQuestionsCache(prev => ({...prev, [index]: { scenario: "**Error:** Failed to generate question from AI Engine.", subQuestions: [] }}));
    } finally {
      if (!isPreload) setIsLoadingQuestion(false);
    }
  };

  const hasTimerStarted = useRef(false);

  useEffect(() => {
    if (isExamFinished || isTimerPaused) return;
    
    const timerId = setInterval(() => {
      if (examPhase === 'reading') {
        setReadingTimeRemaining((prev) => {
          if (prev <= 1) {
            setExamPhase('writing');
            return 0;
          }
          return prev - 1;
        });
      } else {
        setTotalTimeRemaining((prev) => {
          if (prev > 0) hasTimerStarted.current = true;
          return prev > 0 ? prev - 1 : 0;
        });
        setTimeSpent(prev => ({
          ...prev,
          [currentIndex]: (prev[currentIndex] || 0) + 1
        }));
      }
    }, 1000);
    
    return () => clearInterval(timerId);
  }, [isExamFinished, currentIndex, isTimerPaused, examPhase]);

  useEffect(() => {
    if (totalTimeRemaining === 0 && hasTimerStarted.current && !isExamFinished) {
      handleFinishExam();
    }
  }, [totalTimeRemaining, isExamFinished]);

  const handleSubQuestionChange = (subId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentIndex]: {
        ...(prev[currentIndex] || {}),
        [subId]: value
      }
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Only PDF files are allowed.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setPdfFiles(prev => ({
          ...prev,
          [currentIndex]: { file, base64: base64String }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFinishExam = async () => {
    setIsExamFinished(true);
    setIsGrading(true);

    const targetTimeFormattedTotal = plan.reduce((acc, q) => acc + q.timeLimitSec, 0);
    const timeTakenTotal = targetTimeFormattedTotal - totalTimeRemaining;
    
    // Average time per question
    const timeTakenPerQ = Math.floor(timeTakenTotal / plan.length);

    try {
      // Grade in parallel or sequentially. We will do sequentially to avoid hitting rate limits.
      const results: Record<number, string> = {};
      for (let i = 0; i < plan.length; i++) {
        const spec = plan[i];
        const qData = questionsCache[i];
        const qAnswers = answers[i] || {};
        const qPdf = pdfFiles[i];

        if (!qData || qData.error || qData.subQuestions.length === 0) {
           results[i] = "Question was skipped or errored.";
           continue;
        }

        const answerJson = JSON.stringify(qAnswers);
        const targetTimeQ = `${Math.floor(spec.timeLimitSec / 60)}m`;
        const timeTakenForQ = timeSpent[i] || 0;
        const timeTakenFormatted = `${Math.floor(timeTakenForQ / 60)}m ${timeTakenForQ % 60}s`;

        try {
          if (!navigator.onLine) {
             throw new Error("Offline");
          }
          if (tier !== 'pro') {
             throw new Error("FreeTier");
          }
          const evalResult = await gradeAnswerMode(
            answerJson,
            qPdf ? qPdf.base64 : null,
            timeTakenFormatted,
            targetTimeQ,
            qData.scenario + "\\n" + qData.subQuestions.map(sq => sq.text).join("\\n")
          );
          results[i] = evalResult || "No result generated.";
        } catch(err) {
          console.error("Grading failed for q", i, err);
          let fallback = "";
          if (!navigator.onLine || (err instanceof Error && err.message === "Offline")) {
            fallback = "_You are currently offline. AI grading is not available. Here are the model answers:_\n\n";
          } else if (err instanceof Error && err.message === "FreeTier") {
            fallback = "_Pro subscription required for AI grading. [Click here to upgrade](/pricing)\n\nHere are the standard model answers:_\n\n";
          } else {
            fallback = "_An error occurred during AI grading. Here are the model answers:_\n\n";
          }
          
          qData.subQuestions.forEach((sq: any) => {
             fallback += `**Q:** ${sq.text}\n\n**Your Answer:** ${qAnswers[sq.id] || '*(No answer provided)*'}\n\n**Model Answer:** ${sq.modelAnswer || '*(No model answer available)*'}\n\n---\n\n`;
          });
          results[i] = fallback;
        }
      }
      setGradingResults(results);
      
      try {
        let totalCandidateScore = 0;
        let totalMaxPoints = 0;
        for (let i = 0; i < plan.length; i++) {
          const resText = results[i];
          if (resText) {
            try {
              const parsed = JSON.parse(resText);
              totalCandidateScore += Number(parsed.candidateScore) || 0;
              totalMaxPoints += Number(parsed.totalPoints) || 0;
            } catch (e) {
              // Plaintxt or offline fallback
            }
          }
        }

        let readableExamType = 'Custom Practice Exam';
        if (examId) {
          if (examId.startsWith('realpast_')) {
            readableExamType = decodeURIComponent(examId.substring('realpast_'.length));
          } else if (examId.startsWith('realpastb64_')) {
            try {
              const config = JSON.parse(atob(examId.substring('realpastb64_'.length)));
              readableExamType = `${config.y || 'Mixed'} ${config.p || 'Paper'} (${config.t || 'All Types'})`;
            } catch (e) {
              readableExamType = 'Past Paper Simulation';
            }
          } else if (examId.startsWith('combined_')) {
            const parts = examId.split('_');
            readableExamType = `Custom Combo (${parts[1]} Qs)`;
          } else if (examId === 'bookmarks') {
            readableExamType = 'Bookmarks Practice';
          } else {
            readableExamType = `Practice Exam - ${examId}`;
          }
        }

        const totalTimeTakenFormatted = `${Math.floor(timeTakenTotal / 60)}m ${timeTakenTotal % 60}s`;

        await submitExam({
          exam_type: readableExamType,
          score: totalCandidateScore.toFixed(1),
          max_score: totalMaxPoints.toFixed(1),
          time_taken: totalTimeTakenFormatted,
          answers: {
            questions: plan.map((p, idx) => ({
              label: p.label || `Question ${idx + 1}`,
              topic: p.topic,
              studentAnswers: answers[idx] || {},
              grading: results[idx] || 'N/A'
            }))
          }
        });
      } catch (submitErr) {
        console.error("Failed to submit exam scorecard to server", submitErr);
      }
    } catch (err) {
      console.error("Error during full grading", err);
    } finally {
      setIsGrading(false);
    }
  };

  const navigateTo = (index: number) => {
    setCurrentIndex(index);
  };

  if (!bankLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 mb-4 animate-spin text-blue-600" />
      </div>
    );
  }

  if (plan.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-slate-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">No Questions Found</h2>
        <p className="text-slate-500 mt-2 mb-6">We couldn't find any questions matching your current criteria or past paper selection.</p>
        <button onClick={() => navigate('/dashboard')} className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">Go Back</button>
      </div>
    );
  }

  const currentSpec = plan[currentIndex];
  const currentData = questionsCache[currentIndex];
  const isTimeCritical = totalTimeRemaining < 300 && !isExamFinished; // less than 5 min

  // Exam Finished View (Grading Page)
  if (isExamFinished) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-6">
        <div className="max-w-4xl mx-auto w-full bg-white rounded-xl shadow border border-slate-200">
          <div className="p-6 border-b border-slate-200 bg-slate-900 text-white rounded-t-xl flex justify-between items-center">
            <h1 className="text-2xl font-bold">Exam Results</h1>
            <button 
              onClick={() => navigate('/dashboard')}
              className="bg-white text-slate-900 px-4 py-2 rounded font-bold hover:bg-slate-100 transition"
            >
              Exit to Dashboard
            </button>
          </div>
          
          <div className="p-6">
            {isGrading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                <Loader2 className="w-12 h-12 mb-4 animate-spin text-blue-600" />
                <p className="text-lg font-medium">The AI Assessor is reviewing your entire exam...</p>
                <p className="text-sm mt-2 text-slate-500">This may take a few moments as we evaluate against the Angoff standard.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {plan.map((p, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-6 relative">
                    <div className="flex justify-between items-start mb-2">
                       <h3 className="font-bold text-lg">{p.label} - {p.topic}</h3>
                       {p.bankId && (
                         <button
                           onClick={() => {
                             toggleBookmark(p.bankId!);
                             try { setBookmarks(JSON.parse(localStorage.getItem('ranzco_bookmarks') || '[]')); } catch (e) {}
                           }}
                           title="Mark for Repeat"
                           className={`p-2 rounded-md transition ${
                             bookmarks.includes(p.bankId)
                               ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                               : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                           }`}
                         >
                           <Bookmark className={`w-5 h-5 ${bookmarks.includes(p.bankId) ? 'fill-current' : ''}`} />
                         </button>
                       )}
                    </div>
                    <div className="prose prose-slate max-w-none text-sm text-slate-700 bg-slate-50 p-4 rounded mb-4">
                      <strong>Scenario:</strong>
                      <Markdown urlTransform={customUrlTransform} components={MarkdownComponents}>{questionsCache[idx]?.scenario || 'N/A'}</Markdown>
                    </div>
                    {questionsCache[idx]?.subQuestions.map(sq => (
                      <div key={sq.id} className="mb-2">
                        <strong className="text-sm block text-slate-800">{sq.text}</strong>
                        <p className="text-sm text-slate-600 bg-white border border-slate-200 p-2 rounded mt-1">
                          {answers[idx]?.[sq.id] || <span className="italic text-slate-400">No answer provided</span>}
                        </p>
                      </div>
                    ))}
                    <div className="mt-6 pt-6 border-t border-slate-200 prose prose-slate max-w-none">
                      <h4 className="text-blue-800 border-b border-blue-100 pb-2">AI Feedback & Model Answer</h4>
                      <div className="markdown-body mt-4">
                         {(() => {
                           const resText = gradingResults[idx];
                           if (resText && resText.trim().startsWith('{') && resText.trim().endsWith('}')) {
                             try {
                               const parsed = JSON.parse(resText);
                               return (
                                 <div className="space-y-6">
                                   {/* Scorecard Summary */}
                                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                     <div className="p-3 bg-white border border-slate-100 rounded-md shadow-sm">
                                       <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Candidate Score</span>
                                       <div className="text-3xl font-black text-slate-800 mt-1">
                                         {parsed.candidateScore} <span className="text-sm font-normal text-slate-400">/ {parsed.totalPoints} points</span>
                                       </div>
                                     </div>
                                     <div className="p-3 bg-white border border-slate-100 rounded-md shadow-sm">
                                       <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Angoff Pass Mark</span>
                                       <div className="text-2xl font-black text-slate-700 mt-2">
                                         {parsed.angoffPassMark} <span className="text-sm font-normal text-slate-400">points</span>
                                       </div>
                                     </div>
                                     <div className="p-3 bg-white border border-slate-100 rounded-md shadow-sm flex items-center justify-center">
                                       <span className={`w-full text-center py-2 rounded-lg text-sm font-black uppercase tracking-wider ${
                                         parsed.passed ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
                                       }`}>
                                         {parsed.passed ? 'PASS' : 'FAIL'}
                                       </span>
                                     </div>
                                   </div>

                                   {/* Time Critique */}
                                   {parsed.timeCritique && (
                                     <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-900 flex items-center gap-2">
                                       <span className="font-bold">⏱️ Time Assessment:</span>
                                       <span>{parsed.timeCritique}</span>
                                     </div>
                                   )}

                                   {/* Detailed Rubric Checklist */}
                                   {parsed.detailedRubric && parsed.detailedRubric.length > 0 && (
                                     <div className="space-y-3">
                                       <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Detailed Marking Rubric</h5>
                                       <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 shadow-sm">
                                         {parsed.detailedRubric.map((item: any, rIdx: number) => (
                                           <div key={rIdx} className="p-4 flex items-start gap-4 bg-white text-sm hover:bg-slate-50 transition">
                                             <div className="mt-0.5">
                                               {item.checked ? (
                                                 <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xs">✓</div>
                                               ) : (
                                                 <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-400 text-xs">✗</div>
                                               )}
                                             </div>
                                             <div className="flex-grow">
                                               <div className="flex justify-between items-start gap-2">
                                                 <span className="font-semibold text-slate-800">{item.criterion}</span>
                                                 <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">
                                                   {item.points} / {item.maxPoints} pts
                                                 </span>
                                               </div>
                                               {item.feedback && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{item.feedback}</p>}
                                             </div>
                                           </div>
                                         ))}
                                       </div>
                                     </div>
                                   )}

                                   {/* General Feedback Comments */}
                                   {parsed.generalFeedback && (
                                     <div className="prose prose-slate max-w-none text-sm bg-white border border-slate-200 p-5 rounded-lg shadow-sm">
                                       <h5 className="font-bold text-slate-800 mb-3 uppercase tracking-wider text-xs border-b border-slate-100 pb-2">Assessor Critique & Comments</h5>
                                       <Markdown urlTransform={customUrlTransform} components={MarkdownComponents}>{parsed.generalFeedback}</Markdown>
                                     </div>
                                   )}
                                 </div>
                               );
                             } catch (jsonErr) {}
                           }
                           return <Markdown urlTransform={customUrlTransform} components={MarkdownComponents}>{resText}</Markdown>;
                         })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {zoomedImage && <ImageModal src={zoomedImage.src} alt={zoomedImage.alt} onClose={() => setZoomedImage(null)} />}
      </div>
    );
  }

  // Active Exam View
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {zoomedImage && <ImageModal src={zoomedImage.src} alt={zoomedImage.alt} onClose={() => setZoomedImage(null)} />}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row gap-4 sm:justify-between items-start sm:items-center sticky top-0 z-10 w-full">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Exam Session</h1>
          <p className="text-sm text-slate-500">
            {currentSpec?.label || `Question ${currentIndex + 1} of ${plan.length}`} 
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleBookmark}
            disabled={!plan[currentIndex]?.bankId}
            title={!plan[currentIndex]?.bankId ? "Cannot bookmark AI generated questions" : "Mark for Repeat"}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition text-sm font-medium ${
              plan[currentIndex]?.bankId && bookmarks.includes(plan[currentIndex].bankId!)
                ? 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-50'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${plan[currentIndex]?.bankId && bookmarks.includes(plan[currentIndex].bankId!) ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">Bookmark</span>
          </button>

          {!isFullPaper && (
            <button 
              onClick={() => setIsTimerPaused(!isTimerPaused)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-sm font-medium text-slate-700"
            >
              {isTimerPaused ? <><Play className="w-4 h-4" /> Resume Timer</> : <><Pause className="w-4 h-4" /> Pause Timer</>}
            </button>
          )}

          {examPhase === 'reading' ? (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg font-mono text-xl font-bold bg-amber-100 text-amber-800">
              <BookOpen className="w-6 h-6" />
              <span>Reading: {formatTime(readingTimeRemaining)}</span>
            </div>
          ) : (
            <div className={`flex items-center gap-3 px-4 py-2 rounded-lg font-mono text-xl font-bold transition-colors ${isTimeCritical ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-slate-100 text-slate-800'}`}>
              <Clock className="w-6 h-6" />
              <span>{isTimerPaused ? 'PAUSED' : formatTime(totalTimeRemaining)}</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 md:border-r border-b md:border-b-0 border-slate-200 bg-white p-4 flex md:flex-col overflow-x-auto md:overflow-y-auto shrink-0 z-20">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider hidden md:block mb-4">Questions</h3>
          <div className="flex md:grid md:grid-cols-4 gap-2 mb-0 md:mb-8 pb-2 md:pb-0 flex-nowrap">
            {plan.map((p, idx) => (
              <button
                key={idx}
                onClick={() => navigateTo(idx)}
                className={`w-10 h-10 shrink-0 rounded font-medium text-sm border flex items-center justify-center transition-colors ${
                  idx === currentIndex 
                    ? 'bg-blue-600 text-white border-blue-600'
                    : answers[idx] && Object.keys(answers[idx]).length > 0
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          
          <div className="hidden md:block mt-auto pt-6 border-t border-slate-100">
             <button
                onClick={handleFinishExam}
                className="w-full bg-slate-900 text-white font-medium py-3 rounded hover:bg-slate-800 transition"
             >
                Finish Exam
             </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-grow flex flex-col md:flex-row p-4 md:p-6 gap-4 md:gap-6 overflow-y-auto md:overflow-hidden">
          {isLoadingQuestion ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 py-12">
              <Loader2 className="w-12 h-12 mb-4 animate-spin text-blue-600" />
              <p className="text-lg font-medium">Loading question...</p>
            </div>
          ) : (
            <>
              {/* Scenario Column */}
              <div className="w-full md:w-1/2 bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 md:overflow-y-auto relative flex flex-col">
                <div className="flex-grow">
                  <div className="prose prose-slate max-w-none">
                    {currentData ? <Markdown urlTransform={customUrlTransform} components={MarkdownComponents}>{currentData.scenario}</Markdown> : <p>Error loading scenario.</p>}
                  </div>
                </div>
              </div>

              {/* Answers Column */}
              <div className="w-full md:w-1/2 flex flex-col gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 flex flex-col md:h-full md:overflow-y-auto relative">
                  <div className="flex-grow mb-6">
                    {currentData?.subQuestions.map((sq, i) => (
                      <div key={sq.id} className="mb-6 last:mb-0">
                        <label className="block text-slate-800 font-medium mb-2">
                          <span className="font-bold text-blue-600 mr-2">{String.fromCharCode(97 + i)}.</span>
                          {sq.text}
                        </label>
                        <textarea
                          value={answers[currentIndex]?.[sq.id] || ''}
                          onChange={(e) => handleSubQuestionChange(sq.id, e.target.value)}
                          placeholder={examPhase === 'reading' ? "Writing is disabled during reading time..." : "Type your answer here..."}
                          disabled={examPhase === 'reading'}
                          className="w-full border border-slate-300 rounded-lg p-3 min-h-[100px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </div>
                    ))}
                  </div>

                  {currentSpec?.type === 'SEQ' && (
                    <div className={`mb-6 border-2 border-dashed border-slate-200 rounded-lg p-6 text-center transition relative ${examPhase === 'reading' ? 'bg-slate-100 opacity-50 cursor-not-allowed' : 'bg-slate-50 hover:bg-slate-100'}`}>
                      <input 
                        type="file" 
                        accept="application/pdf"
                        onChange={handleFileChange}
                        disabled={examPhase === 'reading'}
                        ref={fileInputRef}
                        className={`absolute inset-0 w-full h-full opacity-0 ${examPhase === 'reading' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                      {pdfFiles[currentIndex] ? (
                        <div className="flex flex-col items-center text-green-700 z-10 relative pointer-events-none">
                          <CheckCircle2 className="w-8 h-8 mb-2" />
                          <span className="font-medium">{pdfFiles[currentIndex].file.name}</span>
                          <span className="text-xs text-green-600 mt-1">Attached to this question</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-slate-500 pointer-events-none">
                          <FileUp className="w-8 h-8 mb-2 text-blue-600" />
                          <span className="font-medium text-slate-700">Upload handwritten notes (PDF)</span>
                          <span className="text-xs mt-1">Optional for SEQ questions</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Navigation Footer */}
                  <div className="border-t border-slate-100 pt-4 flex justify-between items-center bg-white sticky bottom-0 mt-auto shrink-0 z-10">
                    <button
                      onClick={() => navigateTo(currentIndex - 1)}
                      disabled={currentIndex === 0}
                      className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Previous
                    </button>
                    {currentIndex < plan.length - 1 ? (
                       <button
                        onClick={() => navigateTo(currentIndex + 1)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 md:px-6 py-2 rounded font-medium hover:bg-blue-700 transition"
                      >
                        Next
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                       <button
                        onClick={handleFinishExam}
                        className="flex items-center gap-2 bg-slate-900 text-white px-4 md:px-6 py-2 rounded font-medium hover:bg-slate-800 transition"
                      >
                        Finish Exam
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
