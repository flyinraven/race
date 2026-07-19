import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Mic, MicOff, Volume2, ChevronRight, CheckCircle2, Loader2, BookOpen, X, User, MessageSquare } from 'lucide-react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import { gradeAnswerMode } from '../services/examEngine';
import { jsonrepair } from 'jsonrepair';

interface SubQuestion {
  id: string;
  text: string;
  modelAnswer?: string;
}

interface StationData {
  scenario: string;
  subQuestions: SubQuestion[];
}

interface GradingResult {
  totalPoints: number;
  angoffPassMark: number;
  candidateScore: number;
  passed: boolean;
  detailedRubric: Array<{
    criterion: string;
    points: number;
    maxPoints: number;
    feedback: string;
    checked: boolean;
  }>;
  generalFeedback: string;
  timeCritique: string;
}

interface OsceStationProps {
  stationLabel: string;
  stationData: StationData;
  stationIndex: number;
  totalStations: number;
  timeLimitSec: number;
  onComplete: (answers: Record<string, string>, timeTaken: number) => void;
  onSkip: () => void;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text.replace(/[*_#`[\]()]/g, ''));
  utter.rate = 0.9;
  utter.pitch = 1.0;
  window.speechSynthesis.speak(utter);
}

export function OsceStation({
  stationLabel,
  stationData,
  stationIndex,
  totalStations,
  timeLimitSec,
  onComplete,
  onSkip,
}: OsceStationProps) {
  const [phase, setPhase] = useState<'briefing' | 'questioning' | 'grading' | 'results'>('briefing');
  const [currentSubQIndex, setCurrentSubQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(timeLimitSec);
  const [timeTaken, setTimeTaken] = useState(0);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  answersRef.current = answers;

  const subQuestions = stationData?.subQuestions || [];
  const currentSubQ = subQuestions[currentSubQIndex];

  const timerWarning = timeRemaining < 60;
  const timerCritical = timeRemaining < 30;

  const handleFinishStation = useCallback(async (finalAnswers: Record<string, string>) => {
    clearInterval(timerRef.current!);
    setPhase('grading');
    try {
      // Build a combined answer string for all sub-questions
      const combinedAnswer = subQuestions.map(sq =>
        `Q: ${sq.text}\nA: ${finalAnswers[sq.id] || '(No answer provided)'}`
      ).join('\n\n');
      const questionContext = stationData.scenario + '\n\n' +
        subQuestions.map(sq => `${sq.text}\nModel Answer: ${sq.modelAnswer || ''}`).join('\n\n');
      const timeTakenStr = `${Math.floor(timeTaken / 60)}m ${timeTaken % 60}s`;
      const targetTimeStr = `${Math.floor(timeLimitSec / 60)}m`;
      const rawResult = await gradeAnswerMode(
        combinedAnswer,
        null,
        timeTakenStr,
        targetTimeStr,
        questionContext
      );
      try {
        const parsed = typeof rawResult === 'string' ? JSON.parse(jsonrepair(rawResult)) : rawResult;
        setGradingResult(parsed);
      } catch {
        // If parse fails, show a basic result
        setGradingResult(null);
      }
    } catch (err) {
      console.error('Grading error:', err);
      setGradingResult(null);
    } finally {
      setPhase('results');
    }
  }, [subQuestions, stationData, timeTaken, timeLimitSec]);

  useEffect(() => {
    if (phase !== 'questioning' && phase !== 'briefing') return;
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleFinishStation(answersRef.current);
          return 0;
        }
        return prev - 1;
      });
      setTimeTaken(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [phase, handleFinishStation]);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Mic only works in Chrome.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-AU';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setCurrentAnswer(prev => prev ? prev + ' ' + transcript : transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const handleNextSubQ = () => {
    if (!currentSubQ) return;
    const updated = { ...answers, [currentSubQ.id]: currentAnswer };
    setAnswers(updated);
    setCurrentAnswer('');
    if (currentSubQIndex < subQuestions.length - 1) {
      setCurrentSubQIndex(prev => prev + 1);
    } else {
      handleFinishStation(updated);
    }
  };

  const customUrlTransform = (value: string) => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    if (value.startsWith('data:image/')) return value;
    if (value.startsWith('SEARCH_IMAGE:')) {
      return apiBase + '/api/image-search-proxy?q=' + encodeURIComponent(value.replace('SEARCH_IMAGE:', '').replace(/\+/g, ' '));
    }
    return defaultUrlTransform(value);
  };

  const MarkdownComponents = {
    img: ({ node, ...props }: any) => {
      if (!props.src) return null;
      let proxySrc = props.src;
      const apiBase = import.meta.env.VITE_API_URL || '';
      if (proxySrc.includes('wikimedia.org')) {
          proxySrc = apiBase + '/api/image-proxy?url=' + encodeURIComponent(proxySrc);
      } else if (proxySrc.includes('placehold.co') && proxySrc.includes('text=')) {
          const match = proxySrc.match(/text=([^&]+)/);
          if (match && match[1]) {
             let extractedQuery = decodeURIComponent(match[1]).replace(/\+/g, ' ');
             proxySrc = apiBase + '/api/image-search-proxy?q=' + encodeURIComponent(extractedQuery);
          }
      }
      return (
        <img
          alt={props.alt || 'Clinical image'}
          src={proxySrc}
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.onerror = null;
            target.src = 'https://placehold.co/600x400/png?text=Image+Not+Available';
          }}
          className={`max-w-full max-h-64 h-auto rounded-lg shadow border border-slate-200 my-4 ${
            phase === 'questioning' ? 'md:block hidden' : ''
          }`}
        />
      );
    }
  };

  const timerBar = (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold text-sm ${
      timerCritical ? 'bg-red-900/70 text-red-300 animate-pulse' :
      timerWarning ? 'bg-amber-900/70 text-amber-300' :
      'bg-slate-800 text-slate-300'
    }`}>
      <Clock className="w-4 h-4" />
      {formatTime(timeRemaining)}
    </div>
  );

  const stationHeader = (subtitle: string) => (
    <div className="bg-slate-900/80 backdrop-blur border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
          {stationIndex + 1}
        </div>
        <div>
          <p className="text-white font-semibold text-sm">{stationLabel}</p>
          <p className="text-slate-400 text-xs">{subtitle}</p>
        </div>
      </div>
      {timerBar}
    </div>
  );

  // BRIEFING
  if (phase === 'briefing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 flex flex-col">
        {stationHeader(`Station ${stationIndex + 1} of ${totalStations}`)}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-3xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-indigo-700 px-8 py-5">
              <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-indigo-200" />
                <h1 className="text-white font-bold text-xl">OSCE Station Briefing</h1>
              </div>
              <p className="text-indigo-200 text-sm mt-1">Read the clinical scenario carefully before the examination begins.</p>
            </div>
            <div className="p-8">
              <div className="prose prose-sm max-w-none text-slate-800">
                <Markdown urlTransform={customUrlTransform} components={MarkdownComponents}>
                  {stationData.scenario}
                </Markdown>
              </div>
              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setPhase('questioning')}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl transition flex items-center justify-center gap-2 text-lg shadow-lg"
                >
                  I'm Ready — Begin Examination
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button onClick={onSkip} className="px-5 py-4 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition text-sm font-medium">
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }  // QUESTIONING
  if (phase === 'questioning') {
    const progress = (currentSubQIndex / subQuestions.length) * 100;

    // Extract image url for sticky rendering on mobile
    const imgMatch = stationData.scenario.match(/!\[.*?\]\((.*?)\)/);
    const imageUrl = imgMatch ? imgMatch[1] : null;
    let extractedImageSrc = null;
    if (imageUrl) {
      extractedImageSrc = imageUrl;
      const apiBase = import.meta.env.VITE_API_URL || '';
      if (extractedImageSrc.startsWith('SEARCH_IMAGE:')) {
        extractedImageSrc = apiBase + '/api/image-search-proxy?q=' + encodeURIComponent(extractedImageSrc.replace('SEARCH_IMAGE:', '').replace(/\+/g, ' '));
      } else if (extractedImageSrc.includes('wikimedia.org')) {
        extractedImageSrc = apiBase + '/api/image-proxy?url=' + encodeURIComponent(extractedImageSrc);
      } else if (extractedImageSrc.includes('placehold.co') && extractedImageSrc.includes('text=')) {
        const match = extractedImageSrc.match(/text=([^&]+)/);
        if (match && match[1]) {
           let extractedQuery = decodeURIComponent(match[1]).replace(/\+/g, ' ');
           extractedImageSrc = apiBase + '/api/image-search-proxy?q=' + encodeURIComponent(extractedQuery);
        }
      }
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 flex flex-col">
        {stationHeader(`Question ${currentSubQIndex + 1} of ${subQuestions.length}`)}
        <div className="h-1 bg-slate-800">
          <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Mobile Sticky Image Header */}
        {extractedImageSrc && (
          <div className="md:hidden w-full bg-slate-900/95 backdrop-blur border-b border-slate-800 p-3 sticky top-0 z-10 flex justify-center shadow-lg">
            <img
              src={extractedImageSrc}
              alt="Clinical reference"
              className="max-h-52 w-auto rounded-lg border border-slate-700 shadow-md"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.onerror = null;
                target.src = 'https://placehold.co/600x400/png?text=Image+Not+Available';
              }}
            />
          </div>
        )}

        <div className="flex-grow flex flex-col md:flex-row gap-6 max-w-6xl mx-auto w-full p-6 md:overflow-hidden overflow-y-auto">
          
          {/* Left Column: Briefing Stem & Pictures (displayed during the entire question) */}
          <div className="flex-1 bg-slate-850/90 border border-slate-750/80 rounded-2xl p-6 overflow-y-auto max-h-[80vh] shadow-xl text-white">
            <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-3 border-b border-indigo-900/50 pb-2">Briefing & Clinical Reference</h4>
            <div className="prose prose-sm prose-invert max-w-none">
              <Markdown urlTransform={customUrlTransform} components={MarkdownComponents}>
                {stationData.scenario}
              </Markdown>
            </div>
          </div>

          {/* Right Column: Examiner Verbal Question & Candidate Response */}
          <div className="w-full md:w-[420px] flex flex-col gap-5 flex-shrink-0">
            {/* Examiner bubble */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center flex-shrink-0 shadow-lg mt-1">
                <User className="w-5 h-5 text-indigo-200" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-indigo-300 font-semibold text-sm">Examiner</span>
                  <button onClick={() => speak(currentSubQ?.text || '')} title="Read aloud" className="p-1 rounded-full text-slate-500 hover:text-indigo-400 transition">
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-none px-5 py-3 shadow-lg">
                  <p className="text-white text-base leading-relaxed">{currentSubQ?.text}</p>
                </div>
              </div>
            </div>

            {currentSubQIndex > 0 && (
              <p className="text-center text-xs text-slate-650 font-medium">{currentSubQIndex} response{currentSubQIndex > 1 ? 's' : ''} recorded</p>
            )}

            {/* Candidate response */}
            <div className="flex items-start gap-3 flex-grow flex-col">
              <div className="w-full flex items-center justify-between">
                <span className="text-emerald-300 font-semibold text-sm">Your Response</span>
                <div className="flex items-center gap-2">
                  {speechError && <span className="text-xs text-amber-400">{speechError}</span>}
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {isListening ? 'Speak' : 'Speak'}
                  </button>
                </div>
              </div>
              <textarea
                value={currentAnswer}
                onChange={e => setCurrentAnswer(e.target.value)}
                placeholder="Type your verbal response here as if you're speaking to the examiner..."
                rows={10}
                className="w-full bg-slate-800 border border-emerald-700/50 rounded-2xl rounded-tl-none px-4 py-3 text-white placeholder-slate-550 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none text-sm leading-relaxed shadow-lg flex-grow min-h-[160px]"
              />
              <button
                onClick={handleNextSubQ}
                disabled={!currentAnswer.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-xl transition flex items-center justify-center gap-2 shadow-lg text-sm"
              >
                {currentSubQIndex < subQuestions.length - 1 ? <>Next Question <ChevronRight className="w-4 h-4" /></> : <>Submit Station <CheckCircle2 className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // GRADING
  if (phase === 'grading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="text-center px-6">
          <Loader2 className="w-16 h-16 text-indigo-400 animate-spin mx-auto mb-6" />
          <p className="text-white text-2xl font-bold">Marking your responses...</p>
          <p className="text-slate-400 mt-2">The examiner is reviewing your answers against the Angoff standard.</p>
        </div>
      </div>
    );
  }

  // RESULTS
  const passed = gradingResult?.passed;
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        {/* Score */}
        <div className={`rounded-2xl p-6 text-center shadow-2xl border ${
          passed ? 'bg-emerald-900/50 border-emerald-700' : 'bg-red-900/50 border-red-700'
        }`}>
          <p className={`text-5xl font-black mb-2 ${passed ? 'text-emerald-300' : 'text-red-300'}`}>
            {gradingResult?.candidateScore ?? '—'} / {gradingResult?.totalPoints ?? '—'}
          </p>
          <p className={`text-lg font-semibold ${passed ? 'text-emerald-400' : 'text-red-400'}`}>
            {passed ? '✓ Pass' : '✗ Below Pass Mark'} — Angoff pass mark: {gradingResult?.angoffPassMark ?? '—'}
          </p>
          <p className="text-slate-300 text-sm mt-2">{stationLabel}</p>
        </div>

        {gradingResult?.timeCritique && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-300 text-sm"><span className="text-slate-400 font-semibold">Time: </span>{gradingResult.timeCritique}</p>
          </div>
        )}

        {/* Q&A + model answers */}
        {subQuestions.map((sq) => (
          <div key={sq.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="bg-slate-700/50 px-5 py-3">
              <p className="text-white font-semibold text-sm">{sq.text}</p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1">Your Answer</p>
                <p className="text-slate-300 text-sm bg-slate-900/50 rounded-lg px-4 py-3 leading-relaxed">
                  {answers[sq.id] || <em className="text-slate-500">No answer provided</em>}
                </p>
              </div>
              {sq.modelAnswer && (
                <div>
                  <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-1">Model Answer</p>
                  <p className="text-slate-300 text-sm bg-indigo-950/30 border border-indigo-900/40 rounded-lg px-4 py-3 leading-relaxed">{sq.modelAnswer}</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Rubric */}
        {gradingResult?.detailedRubric && gradingResult.detailedRubric.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <p className="text-white font-bold mb-3">Marking Rubric</p>
            <div className="space-y-3">
              {gradingResult.detailedRubric.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${item.checked ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                    {item.checked ? <CheckCircle2 className="w-4 h-4 text-white" /> : <X className="w-3 h-3 text-slate-400" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-slate-200 text-sm font-medium">{item.criterion}</p>
                      <span className="text-xs font-mono text-slate-400">{item.points}/{item.maxPoints}</span>
                    </div>
                    {item.feedback && <p className="text-slate-400 text-xs mt-0.5">{item.feedback}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        {gradingResult?.generalFeedback && (
          <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-xl p-5">
            <p className="text-indigo-300 font-bold mb-2">Examiner Feedback</p>
            <p className="text-slate-300 text-sm leading-relaxed">{gradingResult.generalFeedback}</p>
          </div>
        )}

        <button
          onClick={() => onComplete(answers, timeTaken)}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition shadow-lg flex items-center justify-center gap-2 text-lg"
        >
          {stationIndex < totalStations - 1 ? <>Next Station <ChevronRight className="w-5 h-5" /></> : <>Complete OSCE Exam <CheckCircle2 className="w-5 h-5" /></>}
        </button>
      </div>
    </div>
  );
}
