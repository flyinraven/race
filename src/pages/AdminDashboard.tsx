import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, ShieldUser, Database, Upload, Users, Trash2, Loader2, Cpu, ChevronDown, ChevronUp, FileText, CheckCircle, Edit2, Mail, Save, X } from 'lucide-react';
import { parsePDFQuestionBank, getBank, saveBank, deleteQuestions, BankQuestion, getCurriculum, saveCurriculum, updateQuestion, generateFreshQuestions, getExamGuidelines, saveExamGuidelines, generateCustomBatch } from '../services/examEngine';
import { getUsers, addUser, updateUser, deleteUser, UserProfile, getSubmissions, deleteSubmission, Submission } from '../services/userService';
import EditQuestionModal from '../components/EditQuestionModal';
import EditUserModal from '../components/EditUserModal';
import EditTemplateModal from '../components/EditTemplateModal';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import OverviewTab from '../components/admin/OverviewTab';
import QuestionBankTab from '../components/admin/QuestionBankTab';
import SettingsTab from '../components/admin/SettingsTab';
import NotificationsTab from '../components/admin/NotificationsTab';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
      className="max-w-md h-auto rounded-lg shadow-sm border border-slate-200 my-4"
    />
  )}
};

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  
  // AI Configuration State
  const [aiProvider, setAiProvider] = useState('google');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [aiConfigSaved, setAiConfigSaved] = useState(false);
  const [curriculumText, setCurriculumText] = useState('');
  const [curriculumSaved, setCurriculumSaved] = useState(false);
  const [examGuidelines, setExamGuidelines] = useState('');
  const [guidelinesSaved, setGuidelinesSaved] = useState(false);

  // Question Bank
  const [bankItems, setBankItems] = useState<BankQuestion[]>([]);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<BankQuestion | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'bank' | 'settings' | 'notifications'>('overview');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const customAlert = (msg: string) => {
    console.log('ALERT:', msg);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Question Bank Filters & Sort
  const [filterTopic, setFilterTopic] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [filterPaper, setFilterPaper] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [sortBy, setSortBy] = useState<'yearDesc' | 'yearAsc' | 'topicAsc' | 'topicDesc' | 'typeAsc' | 'typeDesc'>('yearAsc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Upload Defaults
  const [uploadDefaultYear, setUploadDefaultYear] = useState('');
  const [uploadDefaultPaper, setUploadDefaultPaper] = useState('');

  // Selection
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  const refreshBank = async () => {
    const data = await getBank();
    setBankItems(data);
    setSelectedQuestions([]);
  };

  useEffect(() => {
    setAiProvider(localStorage.getItem('ranzco_ai_provider') || 'google');
    setAiApiKey(localStorage.getItem('ranzco_api_key') || '');
    setAiModel(localStorage.getItem('ranzco_ai_model') || 'gemini-2.5-flash');
    getCurriculum().then(setCurriculumText);
    getExamGuidelines().then(setExamGuidelines);
    refreshBank();
  }, []);

  const saveAiConfig = () => {
    localStorage.setItem('ranzco_ai_provider', aiProvider);
    localStorage.setItem('ranzco_api_key', aiApiKey);
    localStorage.setItem('ranzco_ai_model', aiModel);
    setAiConfigSaved(true);
    setTimeout(() => setAiConfigSaved(false), 3000);
  };
  
  const handleSaveCurriculum = async () => {
    await saveCurriculum(curriculumText);
    setCurriculumSaved(true);
    setTimeout(() => setCurriculumSaved(false), 3000);
  };
  
  const handleSaveGuidelines = async () => {
    await saveExamGuidelines(examGuidelines);
    setGuidelinesSaved(true);
    setTimeout(() => setGuidelinesSaved(false), 3000);
  };
  
  // User Management
  const [usersData, setUsersData] = useState<UserProfile[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Submissions State
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  const refreshSubmissions = async () => {
    try {
      const data = await getSubmissions();
      setSubmissions(data);
    } catch (e: any) {
      console.error('Failed to get submissions', e);
    }
  };

  const handleDeleteSubmission = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this submission scorecard?")) return;
    try {
      const success = await deleteSubmission(id);
      if (success) {
        customAlert("Submission deleted successfully.");
        await refreshSubmissions();
      } else {
        customAlert("Failed to delete submission.");
      }
    } catch (err: any) {
      customAlert(`Error deleting submission: ${err.message}`);
    }
  };

  // Batch Generation State
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number, total: number, waiting?: boolean, waitTime?: number, waitMessage?: string }>({ current: 0, total: 0 });
  const [selectedBatchType, setSelectedBatchType] = useState<'paper1' | 'paper2' | 'paper3' | 'paper4' | 'osce' | 'full_exam'>('paper1');
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  const togglePause = () => {
    isPausedRef.current = !isPausedRef.current;
    setIsPaused(isPausedRef.current);
  };

  const [isFixingFaulty, setIsFixingFaulty] = useState(false);

  const [customGenTopic, setCustomGenTopic] = useState('All');
  const [customGenVsaqCount, setCustomGenVsaqCount] = useState<number | ''>('');
  const [customGenSeqCount, setCustomGenSeqCount] = useState<number | ''>('');
  const [customGenOsceCount, setCustomGenOsceCount] = useState<number | ''>('');

  const [fixStatus, setFixStatus] = useState('');

  // Email Templates
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

  const refreshUsers = async () => {
    try {
      const data = await getUsers();
      setUsersData(data);
    } catch (e: any) {
      console.error('Failed to get users', e);
    }
  };

  const refreshEmailTemplates = async () => {
    try {
      const { getEmailTemplates } = await import('../services/notificationService');
      const data = await getEmailTemplates();
      setEmailTemplates(data);
    } catch (e: any) {
      console.error('Failed to get email templates', e);
    }
  };

  useEffect(() => {
    refreshUsers();
    refreshEmailTemplates();
    refreshSubmissions();
  }, []);

  const handleDeleteFromBank = async (id: string) => {
    try {
      await deleteQuestions([id]);
      await refreshBank();
    } catch (err: any) {
      customAlert(`Error deleting question from database: ${err.message}`);
    }
  };

  
  const handleDownloadPrintable = () => {
    if (selectedQuestions.length === 0) return;
    
    const selected = bankItems.filter(q => selectedQuestions.includes(q.id));
    let textContent = "Ophthalmology Exam - Selected Questions\n\n";
    
    selected.forEach((q, index) => {
      textContent += `Question ${index + 1}: ${q.questionLabel || 'Unnamed'} (${q.type} - ${q.topic})\n`;
      if (q.year && q.year !== 'AI') textContent += `Past Paper: ${q.paper || q.year}\n`;
      textContent += "-".repeat(40) + "\n";
      
      const qData = q.data || {};
      if (qData.scenario) {
          textContent += "SCENARIO:\n" + qData.scenario + "\n\n";
      }
      
      if (qData.subQuestions && Array.isArray(qData.subQuestions)) {
          qData.subQuestions.forEach((sq, sqIdx) => {
             textContent += `${String.fromCharCode(97 + sqIdx)}) ${sq.question} [${sq.marks} marks]\n`;
          });
      }
      
      textContent += "\n" + "=".repeat(40) + "\n\n";
    });
    
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'selected_questions.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkDelete = async () => {
    if (selectedQuestions.length === 0) return;
    
    try {
      await deleteQuestions(selectedQuestions);
      await refreshBank();
      setSelectedQuestions([]);
    } catch (err: any) {
      customAlert(`Error deleting questions from database: ${err.message}`);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedQuestions(prev => 
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (filteredIds: string[]) => {
    if (selectedQuestions.length === filteredIds.length) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions(filteredIds);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(`Reading ${file.name}...`);
    
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setUploadStatus('Extracting questions from PDF using AI (this may take a minute)...');
        const reader = new FileReader();
        
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(file);
        });
        
        const base64 = await base64Promise;
        const addedItems = await parsePDFQuestionBank(base64, file.name, uploadDefaultYear, uploadDefaultPaper, setUploadStatus);
        setUploadStatus(`Successfully extracted and added ${addedItems.length} questions from PDF.`);
      } else {
        // Assume JSON
        const reader = new FileReader();
        
        const textPromise = new Promise<string>((resolve, reject) => {
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsText(file);
        });
        
        const content = await textPromise;
        const questionsArr = JSON.parse(content);
        
        if (!Array.isArray(questionsArr)) {
          throw new Error("Invalid format. Expected a JSON array of questions.");
        }

        const existingBank = await getBank();
        
        let countAdded = 0;
        const newBankItems = questionsArr.map((qData: any) => {
          countAdded++;
          return {
            id: Math.random().toString(36).substring(2, 15),
            type: qData.type || 'VSAQ',
            topic: qData.topic || 'combined',
            data: qData,
            used: false
          };
        });

        await saveBank([...existingBank, ...newBankItems]);
        setUploadStatus(`Successfully added ${countAdded} questions from JSON.`);
      }
      await refreshBank();
    } catch (err) {
      setUploadStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error occurred.'}`);
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
    }
  };

  const processUploadedJSON = async (parsed: any, clearAimatch: boolean = false) => {
    const questionsArr = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    let countAdded = 0;
    const allBank = await getBank();
    const existingBank = clearAimatch ? allBank.filter(q => q.year !== '2024' && q.year !== 'AI') : allBank;

    // Additionally wipe them from DB
    if (clearAimatch) {
       const toDel = allBank.filter(q => q.year === '2024' || q.year === 'AI').map(q => q.id);
       if (toDel.length > 0) {
           await deleteQuestions(toDel);
       }
    }

    const newBankItems: BankQuestion[] = questionsArr.map((qData: any) => {
      countAdded++;
      return {
        id: Math.random().toString(36).substring(2, 15),
        type: qData.type || 'VSAQ',
        topic: qData.topic || 'General',
        paper: qData.paper || uploadDefaultPaper,
        year: qData.year || uploadDefaultYear,
        questionLabel: qData.questionLabel || `${qData.type || 'VSAQ'} - Uploaded`,
        data: qData.data || qData,
        used: false
      };
    });

    await saveBank([...existingBank, ...newBankItems]);
    setUploadStatus(`Successfully added ${countAdded} generated questions.`);
    await refreshBank();
  };

  const handleLoadAIBatch = async () => {
    setIsUploading(true);
    setUploadStatus('Loading generated batch (bypassing quota)...');
    try {
      const response = await fetch('/ai_batch.json');
      if (!response.ok) {
         throw new Error("Could not load AI batch file.");
      }
      const data = await response.json();
      await processUploadedJSON(data, true);
    } catch(err) {
      setUploadStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error occurred.'}`);
    } finally {
      setIsUploading(false);
    }
  };

  
  const handleExportBank = () => {
    const dataStr = JSON.stringify(bankItems, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'question_bank_export.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleCustomGenerate = async () => {
    setIsPaused(false);
    isPausedRef.current = false;
    setIsGeneratingCustom(true);
    setUploadStatus('');
    try {
      const TOPICS = [
        "Cataract", "Cornea and External Eye", "Glaucoma",
        "Neuro-ophthalmology", "Ocular Inflammation", "Ocular Motility",
        "Oculoplastics and Orbit", "Paediatrics", "Vitreoretinal"
      ];
      
      const topicsToUse = customGenTopic === 'All' ? TOPICS : [customGenTopic];
      const questionsToGenerate = [];
      let labelIndex = 1;
      
      const vsaqCount = Number(customGenVsaqCount) || 0;
      const seqCount = Number(customGenSeqCount) || 0;
      const osceCount = Number(customGenOsceCount) || 0;
      
      // VSAQs
      for (let i = 0; i < vsaqCount; i++) {
        questionsToGenerate.push({
          specId: `spec_${Date.now()}_VSAQ_${i}_${Math.random()}`,
          type: 'VSAQ',
          topic: topicsToUse[(labelIndex - 1) % topicsToUse.length],
          label: `Custom - VSAQ Q${i + 1}`,
          paperName: 'Custom Generated'
        });
        labelIndex++;
      }
      
      // SEQs
      for (let i = 0; i < seqCount; i++) {
        questionsToGenerate.push({
          specId: `spec_${Date.now()}_SEQ_${i}_${Math.random()}`,
          type: 'SEQ',
          topic: topicsToUse[(labelIndex - 1) % topicsToUse.length],
          label: `Custom - SEQ Q${i + 1}`,
          paperName: 'Custom Generated'
        });
        labelIndex++;
      }
      
      // OSCEs
      for (let i = 0; i < osceCount; i++) {
        questionsToGenerate.push({
          specId: `spec_${Date.now()}_OSCE_${i}_${Math.random()}`,
          type: 'OSCE',
          topic: topicsToUse[(labelIndex - 1) % topicsToUse.length],
          label: `Custom - OSCE Station ${i + 1}`,
          paperName: 'Custom Generated'
        });
        labelIndex++;
      }

      let remainingSpecs = questionsToGenerate.map(q => ({...q, attempts: 0}));
      
      const chunkSize = 5;
      let generatedCount = 0;
      setBatchProgress({ current: 0, total: questionsToGenerate.length });
      
      while (remainingSpecs.length > 0) {
        if (isPausedRef.current) {
          setBatchProgress(prev => ({ ...prev, waiting: true, waitMessage: 'Generation Paused' }));
          await sleep(1000);
          continue;
        }
        const chunk = remainingSpecs.slice(0, Math.min(chunkSize, remainingSpecs.length));
        let success = false;
        let retryCount = 0;
        
        while (!success && remainingSpecs.length > 0) {
          try {
            const newItems = await generateCustomBatch(chunk);
            success = true;
            
            const generatedSpecIds = newItems.map((item) => item.specId);
            let newlyFailedSpecs = false;
            
            remainingSpecs = remainingSpecs.filter(spec => {
                if (generatedSpecIds.includes(spec.specId)) return false;
                
                if (chunk.some(c => c.specId === spec.specId)) {
                   spec.attempts = (spec.attempts || 0) + 1;
                   if (spec.attempts >= 4) {
                       console.warn(`Spec ${spec.label} failed 3 times, skipping.`);
                       newlyFailedSpecs = true;
                       return false;
                   }
                }
                return true;
            });
            
            if (newlyFailedSpecs) {
               customAlert(`Some questions failed to generate after 3 attempts. Continuing with remaining...`);
            }
            
            generatedCount += newItems.length;
            setBatchProgress({ current: Math.min(generatedCount, questionsToGenerate.length), total: questionsToGenerate.length });
            
            
            await refreshBank();
            
            if (remainingSpecs.length > 0) {
              await sleep(2000);
            }
          } catch (err: any) {
             const errorMessage = typeof err === 'string' ? err.toLowerCase() : JSON.stringify(err, Object.getOwnPropertyNames(err)).toLowerCase();
             if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('too many requests') || errorMessage.includes('resource_exhausted')) {
                retryCount++;
                if (retryCount >= 20) {
                  throw new Error(`Google AI API Quota Error after 20 retries. Try again later.`);
                }
                const backoffSeconds = 30 + (retryCount * 10);
                setBatchProgress(prev => ({ ...prev, waiting: true, waitTime: backoffSeconds, waitMessage: err.message || 'Rate limit or quota hit' }));
                await sleep(backoffSeconds * 1000);
                setBatchProgress(prev => ({ ...prev, waiting: false, waitTime: undefined, waitMessage: undefined }));
                continue;
             }
             
             if (retryCount >= 3) {
                throw new Error(`Failed to generate question chunk after 3 retries: ${err.message || 'Unknown error'}`);
             }
             
             retryCount++;
             await sleep(3000);
          }
        }
      }
      
      customAlert(`Successfully generated custom questions!`);
    } catch (e) {
      customAlert(`Error: ${e.message}`);
    } finally {
      setIsGeneratingCustom(false);
      setBatchProgress({ current: 0, total: 0, waiting: false });
    }
  };


  const handleBatchGenerate = async (type: 'paper1' | 'paper2' | 'paper3' | 'paper4' | 'osce' | 'full_exam') => {
    setIsPaused(false);
    isPausedRef.current = false;
    setIsGeneratingBatch(true);
    try {
      const TOPICS = [
        "Cataract", "Cornea and External Eye", "Glaucoma",
        "Neuro-ophthalmology", "Ocular Inflammation", "Ocular Motility",
        "Oculoplastics and Orbit", "Paediatrics", "Vitreoretinal"
      ];
      
      let papersToGenerate = type === 'full_exam' ? ['paper1', 'paper2', 'paper3', 'paper4', 'osce'] : [type];
      const questionsToGenerate: {specId: string, type: string, topic: string, label: string, paperName: string}[] = [];
      
      for (const p of papersToGenerate) {
        const paperName = p === 'paper1' ? 'Paper 1' : p === 'paper2' ? 'Paper 2' : p === 'paper3' ? 'Paper 3' : p === 'paper4' ? 'Paper 4' : 'OSCE';
        if (p.startsWith('paper')) {
          for (let i = 0; i < 15; i++) {
            questionsToGenerate.push({
              specId: `spec_${Date.now()}_${Math.random()}`,
              type: 'VSAQ',
              topic: TOPICS[(i + (p === 'paper3' || p === 'paper4' ? 4 : 0)) % 9],
              label: `${paperName} - VSAQ Q${i + 1}`,
              paperName
            });
          }
          const seqCount = (p === 'paper2' || p === 'paper4') ? 4 : 5;
          for (let i = 0; i < seqCount; i++) {
            questionsToGenerate.push({
              specId: `spec_${Date.now()}_${Math.random()}`,
              type: 'SEQ',
              topic: TOPICS[(i + 3 + (p === 'paper3' || p === 'paper4' ? 4 : 0)) % 9],
              label: `${paperName} - SEQ Q${16 + i}`,
              paperName
            });
          }
        } else if (p === 'osce') {
          for (let i = 0; i < 18; i++) {
            questionsToGenerate.push({
              specId: `spec_${Date.now()}_${Math.random()}`,
              type: 'OSCE',
              topic: TOPICS[i % 9],
              label: `${paperName} - Station ${i + 1}`,
              paperName
            });
          }
        }
      }

      let remainingSpecs = questionsToGenerate.map(q => ({...q, attempts: 0}));
      
      const chunkSize = 5;
      let generatedCount = 0;
      setBatchProgress({ current: 0, total: questionsToGenerate.length });
      
      while (remainingSpecs.length > 0) {
        if (isPausedRef.current) {
          setBatchProgress(prev => ({ ...prev, waiting: true, waitMessage: 'Generation Paused' }));
          await sleep(1000);
          continue;
        }
        const chunk = remainingSpecs.slice(0, Math.min(chunkSize, remainingSpecs.length));
        let success = false;
        let retryCount = 0;
        
        while (!success && remainingSpecs.length > 0) {
          try {
            const newItems = await generateCustomBatch(chunk);
            success = true;
            
            const generatedSpecIds = newItems.map((item: any) => item.specId);
            let newlyFailedSpecs = false;
            
            remainingSpecs = remainingSpecs.filter(spec => {
                if (generatedSpecIds.includes(spec.specId)) {
                   return false; // Successful, remove from remaining
                }
                
                // If it was in the chunk but failed validation
                if (chunk.some(c => c.specId === spec.specId)) {
                   spec.attempts = (spec.attempts || 0) + 1;
                   if (spec.attempts >= 4) { // Retry up to 3 times
                       console.warn(`Spec ${spec.label} failed 3 times, skipping.`);
                       newlyFailedSpecs = true;
                       return false; // Give up, remove from remaining
                   }
                }
                return true; // Still remaining to be generated
            });
            
            if (newlyFailedSpecs) {
               customAlert(`Some questions failed to generate after 3 attempts. Continuing with remaining...`);
            }
            
            generatedCount += newItems.length;
            setBatchProgress({ current: Math.min(generatedCount, questionsToGenerate.length), total: questionsToGenerate.length });
            
            // Wait 2 seconds between successful chunk requests
            if (remainingSpecs.length > 0) {
              await sleep(2000);
            }
          } catch (err: any) {
             const errorMessage = typeof err === 'string' ? err.toLowerCase() : JSON.stringify(err, Object.getOwnPropertyNames(err)).toLowerCase();
             if (false) {
                 throw new Error(`Google Cloud Billing Quota Exhausted: Please check your Google Cloud Console to increase your quota or set up billing.`);
              } else if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('too many requests') || errorMessage.includes('resource_exhausted')) {
                 retryCount++;
                 if (retryCount > 6) {
                   throw new Error("Google AI API Quota Exceeded after multiple retries. You may have hit your daily free tier limit. Please wait until tomorrow, or use the 'Load Pre-Generated Full Exams' button instead.");
                 }
                 const waitTime = 60 + (retryCount * 5); 
                 console.warn(`Rate limit hit. Retrying (${retryCount}/6) in ${waitTime} seconds...`);
                 setBatchProgress(prev => ({ ...prev, waiting: true, waitTime, waitMessage: err.message || 'Rate limit or quota hit' }));
                 for (let s = waitTime; s > 0; s--) {
                    setBatchProgress(prev => ({ ...prev, waiting: true, waitTime: s, waitMessage: err.message || 'Rate limit or quota hit' }));
                    await sleep(1000);
                 }
                 setBatchProgress(prev => ({ ...prev, waiting: false, waitMessage: undefined }));
             } else {
                retryCount++;
                if (retryCount > 3) {
                  throw new Error(`Failed to generate question chunk after 3 retries: ${err.message}`);
                }
                console.warn(`Error generating question chunk, retrying (${retryCount}/3)...`, err);
                await sleep(5000);
             }
          }
        }
      }
      
      await refreshBank();
      customAlert(`Successfully generated ${type}!`);
    } catch (e: any) {
      customAlert(`Error generating batch: ${e.message}`);
    } finally {
      setIsGeneratingBatch(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  const handleFixFaultyQuestions = async () => {
    setIsFixingFaulty(true);
    setFixStatus('Scanning for faulty questions...');
    try {
      const bank = await getBank();
      const faultyQuestions = bank.filter(q => {
        const scenario = q.data?.scenario || '';
        
        // Skip past exam questions. We only want to auto-fix AI generated questions.
        // Past exam questions need their actual uploaded photos and shouldn't be overwritten.
        if (q.year || (q.paper && q.paper.match(/\d{4}/))) {
            return false; 
        }

        const missingImage = scenario.includes('Image+Not+Found') || scenario.includes('Image Not Found') || scenario.includes('placehold.co') || scenario.includes('SEARCH_IMAGE:');
        const emptySubQuestions = !q.data?.subQuestions || q.data.subQuestions.length === 0;
        const brokenMarkdown = scenario.match(/!\[.*?\]\(([^)]*)\)/);
        let hasBadUrl = false;
        let hasInappropriateImage = false;
        if (brokenMarkdown && brokenMarkdown.length > 1) {
            const url = brokenMarkdown[1].trim();
            if (url === '' || url.includes('placehold') || !url.startsWith('http')) {
               hasBadUrl = true;
            } else if (url.includes('wikimedia.org')) {
                // If the URL comes from wikimedia, ensure it has some medical optical terms or it might be a random fallback image (like a baby or random shape)
                const filename = url.split('/').pop()?.toLowerCase() || '';
                const ophthalmicTerms = ['eye', 'retina', 'fundus', 'cornea', 'cataract', 'glauc', 'optic', 'lid', 'lens', 'sclera', 'macul', 'vision', 'pupil', 'iris', 'oct', 'angiogr', 'scan', 'slit', 'lamp', 'uvei', 'kerat', 'strab', 'myop', 'hyperop', 'astigmat', 'conjunctiv', 'choroid', 'vitreous', 'ophthalm'];
                if (!ophthalmicTerms.some(term => filename.includes(term))) {
                    hasInappropriateImage = true;
                }
                if (url.endsWith('.pdf') || url.endsWith('.svg') || filename.includes('diagram') || filename.includes('icon') || filename.includes('logo')) {
                    hasInappropriateImage = true;
                }
            }
        }
        const lacksImageTag = !scenario.includes('![');
        const looksLikeItNeedsImage = scenario.toLowerCase().includes('the image') || scenario.toLowerCase().includes('this image') || scenario.toLowerCase().includes('figure 1') || scenario.toLowerCase().includes('clinical photograph');
        
        return missingImage || emptySubQuestions || hasBadUrl || hasInappropriateImage || (lacksImageTag && looksLikeItNeedsImage);
      });

      if (faultyQuestions.length === 0) {
        setFixStatus('No faulty questions found in the bank!');
        setTimeout(() => { setFixStatus(''); setIsFixingFaulty(false); }, 3000);
        return;
      }

      setFixStatus(`Found ${faultyQuestions.length} faulty questions. Deleting and regenerating...`);
      
      const specToFaultyMap = new Map();
      const faultySpecs = faultyQuestions.map(q => {
        const specId = `spec_${Date.now()}_${Math.random()}`;
        specToFaultyMap.set(specId, q.id); // Map spec to original faulty question
        return {
          specId,
          type: q.type,
          topic: q.topic,
          label: q.questionLabel || `${q.type} - Fixed Question`,
          paperName: q.paper || 'Generated Paper'
        };
      });

      let remainingSpecs = faultySpecs.map(q => ({...q, attempts: 0}));
      const chunkSize = 5;
      
      while (remainingSpecs.length > 0) {
        if (isPausedRef.current) {
          setFixStatus('Generation Paused');
          await sleep(1000);
          continue;
        }
        const chunk = remainingSpecs.slice(0, Math.min(chunkSize, remainingSpecs.length));
        let success = false;
        let retryCount = 0;
        
        while (!success && remainingSpecs.length > 0) {
          try {
            setFixStatus(`Regenerating chunk... (${remainingSpecs.length} remaining)`);
            const newItems = await generateCustomBatch(chunk);
            success = true;
            
            // Collect the corresponding faulty IDs for the items we successfully generated
            const generatedSpecIds = newItems.map((item: any) => item.specId);
            const faultyIdsToDelete = generatedSpecIds.map((id: string) => specToFaultyMap.get(id)).filter(Boolean);
            
            if (faultyIdsToDelete.length > 0) {
               setFixStatus(`Deleting ${faultyIdsToDelete.length} replaced faulty questions...`);
               await deleteQuestions(faultyIdsToDelete);
            }
            
            remainingSpecs = remainingSpecs.filter(spec => {
                if (generatedSpecIds.includes(spec.specId)) return false;
                
                if (chunk.some(c => c.specId === spec.specId)) {
                   spec.attempts = (spec.attempts || 0) + 1;
                   if (spec.attempts >= 4) {
                       console.warn(`Spec ${spec.label} failed 3 times, skipping.`);
                       return false; // Skip
                   }
                }
                return true;
            });

            
            if (remainingSpecs.length > 0) {
              await new Promise(r => setTimeout(r, 2000)); // Sleep between chunks
            }
          } catch (err: any) {
             const errorMessage = typeof err === 'string' ? err.toLowerCase() : JSON.stringify(err, Object.getOwnPropertyNames(err)).toLowerCase();
             if (false) {
                 throw new Error(`Google Cloud Billing Quota Exhausted: Please check your Google Cloud Console to increase your quota or set up billing.`);
             } else if (errorMessage.includes('429') || errorMessage.includes('too many') || errorMessage.includes('quota')) {
                 retryCount++;
                 if (retryCount > 6) throw new Error("Google AI API Quota Exceeded after multiple retries. You may have hit your daily free tier limit.");
                 const waitTime = 60 + (retryCount * 5);
                 setFixStatus(`Rate Limit Hit. Retrying chunk ${Math.floor((faultySpecs.length - remainingSpecs.length)/chunkSize) + 1} in ${waitTime}s...`);
                 let wait = waitTime;
                 while(wait > 0) {
                     setFixStatus(`Rate Limit Hit. Retrying in ${wait}s...`);
                     wait--;
                     await new Promise(r => setTimeout(r, 1000));
                 }
             } else {
                 retryCount++;
                 if (retryCount > 3) throw err;
                 setFixStatus(`Regenerating chunk failed, retrying (${retryCount}/3)...`);
                 await new Promise(r => setTimeout(r, 5000));
             }
          }
        }
      }
      
      setFixStatus(`Successfully replaced ${faultyQuestions.length} faulty questions.`);
      await refreshBank();
      setTimeout(() => { setFixStatus(''); setIsFixingFaulty(false); }, 5000);
    } catch (e: any) {
      console.error(e);
      setFixStatus(`Error: ${e.message}`);
      setIsFixingFaulty(false);
    }
  };

  const handleAddUser = async () => {
    if (!newEmail.trim()) return;
    try {
      await addUser({
        email: newEmail,
        role: 'student',
        tier: 'free'
      });
      setNewEmail('');
      await refreshUsers();
    } catch (e: any) {
      customAlert(`Error inviting user: ${e.message}`);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteUser(id);
      await refreshUsers();
    } catch (e: any) {
      customAlert(`Error deleting user: ${e.message}`);
    }
  };

  let filteredBank = bankItems.filter(q => {
    if (filterTopic !== 'All' && q.topic !== filterTopic) return false;
    if (filterYear !== 'All' && String(q.year || 'Unknown') !== filterYear) return false;
    if (filterPaper !== 'All' && String(q.paper || 'Unknown') !== filterPaper) return false;
    if (filterType !== 'All' && q.type !== filterType) return false;
    return true;
  });

  filteredBank = filteredBank.sort((a, b) => {
    const yearA = String(a.year || 'Unknown');
    const yearB = String(b.year || 'Unknown');
    const topicA = a.topic || '';
    const topicB = b.topic || '';
    const typeA = a.type || '';
    const typeB = b.type || '';
    const paperA = String(a.paper || '');
    const paperB = String(b.paper || '');

    // Helper to get number from strings like "Question 1"
    const getNum = (str: string) => {
      const match = str.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };
    
    const qLabelNumA = getNum(a.questionLabel || '');
    const qLabelNumB = getNum(b.questionLabel || '');

    let res = 0;
    switch (sortBy) {
      case 'yearDesc': 
        res = yearB.localeCompare(yearA, undefined, {numeric: true}); 
        if (res === 0) res = paperA.localeCompare(paperB, undefined, {numeric: true});
        if (res === 0) res = qLabelNumA - qLabelNumB;
        break;
      case 'yearAsc': 
        res = yearA.localeCompare(yearB, undefined, {numeric: true}); 
        if (res === 0) res = paperA.localeCompare(paperB, undefined, {numeric: true});
        if (res === 0) res = qLabelNumA - qLabelNumB;
        break;
      case 'topicAsc': res = topicA.localeCompare(topicB); break;
      case 'topicDesc': res = topicB.localeCompare(topicA); break;
      case 'typeAsc': res = typeA.localeCompare(typeB); break;
      case 'typeDesc': res = typeB.localeCompare(typeA); break;
      default: res = 0;
    }
    
    // Tie breaker so sorting is consistent
    if (res === 0) {
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
    }
    return res;
  });

  useEffect(() => {
    setCurrentPage(1);
    setSelectedQuestions([]);
  }, [filterTopic, filterYear, filterPaper, filterType, sortBy]);

  const totalPages = Math.ceil(filteredBank.length / itemsPerPage);
  const paginatedBank = filteredBank.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const uniqueTopics = ['All', ...Array.from(new Set(bankItems.map(q => q.topic)))].filter(Boolean);
  const uniqueYears = ['All', ...Array.from(new Set(bankItems.map(q => String(q.year || 'Unknown'))))];
  const uniquePapers = ['All', ...Array.from(new Set(bankItems.map(q => String(q.paper || 'Unknown'))))];
  const uniqueTypes = ['All', ...Array.from(new Set(bankItems.map(q => q.type)))];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded shadow-lg max-w-sm">
          {toastMessage}
        </div>
      )}

      <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <ShieldUser className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold tracking-tight">Admin Portal</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-400">
            <Link to="/dashboard" className="text-blue-400 hover:text-blue-300 transition mr-2">Student Area</Link>
            <Link to="/privacy" className="hover:text-white transition">Privacy</Link>
            <Link to="/terms" className="hover:text-white transition">Terms</Link>
            <Link to="/billing" className="hover:text-white transition">Billing</Link>
          </div>
          <Link to="/profile" className="hidden sm:inline-block text-slate-300 font-medium text-sm hover:text-white underline underline-offset-4 decoration-slate-600 transition">
            {user?.email}
          </Link>
          <button 
            onClick={() => { signOut(); navigate('/'); }}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full p-6 mt-4 flex-grow">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Administrator Dashboard</h2>
        
        <div className="flex border-b border-slate-200 mb-8 overflow-x-auto hide-scrollbar gap-2">
          <button 
            className={`px-6 py-3 font-medium text-sm whitespace-nowrap rounded-t-lg transition-colors ${activeTab === 'overview' ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-b-2 border-transparent'}`} 
            onClick={() => setActiveTab('overview')}
          >
            Overview & Users
          </button>
          <button 
            className={`px-6 py-3 font-medium text-sm whitespace-nowrap rounded-t-lg transition-colors ${activeTab === 'bank' ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-b-2 border-transparent'}`} 
            onClick={() => setActiveTab('bank')}
          >
            Question Bank
          </button>
          <button 
            className={`px-6 py-3 font-medium text-sm whitespace-nowrap rounded-t-lg transition-colors ${activeTab === 'settings' ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-b-2 border-transparent'}`} 
            onClick={() => setActiveTab('settings')}
          >
            System Settings
          </button>
          <button 
            className={`px-6 py-3 font-medium text-sm whitespace-nowrap rounded-t-lg transition-colors ${activeTab === 'notifications' ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-b-2 border-transparent'}`} 
            onClick={() => setActiveTab('notifications')}
          >
            Email Notifications
          </button>
        </div>

        {activeTab === 'overview' && (
          <OverviewTab
            usersData={usersData}
            newEmail={newEmail}
            setNewEmail={setNewEmail}
            handleAddUser={handleAddUser}
            setEditingUser={setEditingUser}
            handleDeleteUser={handleDeleteUser}
            submissions={submissions}
            setSelectedSubmission={setSelectedSubmission}
            handleDeleteSubmission={handleDeleteSubmission}
          />
        )}

        {activeTab === 'bank' && (
          <QuestionBankTab
            uniqueTopics={uniqueTopics}
            uniquePapers={uniquePapers}
            uniqueYears={uniqueYears}
            uniqueTypes={uniqueTypes}
            filterTopic={filterTopic}
            setFilterTopic={setFilterTopic}
            filterPaper={filterPaper}
            setFilterPaper={setFilterPaper}
            filterYear={filterYear}
            setFilterYear={setFilterYear}
            filterType={filterType}
            setFilterType={setFilterType}
            sortBy={sortBy}
            setSortBy={setSortBy}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            itemsPerPage={itemsPerPage}
            filteredBank={filteredBank}
            paginatedBank={paginatedBank}
            totalPages={totalPages}
            selectedQuestions={selectedQuestions}
            setSelectedQuestions={setSelectedQuestions}
            toggleSelectAll={toggleSelectAll}
            toggleSelection={toggleSelection}
            handleBulkDelete={handleBulkDelete}
            handleDownloadPrintable={handleDownloadPrintable}
            setEditingQuestion={setEditingQuestion}
            handleDeleteFromBank={handleDeleteFromBank}
            expandedQuestionId={expandedQuestionId}
            setExpandedQuestionId={setExpandedQuestionId}
            customUrlTransform={customUrlTransform}
            MarkdownComponents={MarkdownComponents}
            customGenTopic={customGenTopic}
            setCustomGenTopic={setCustomGenTopic}
            customGenVsaqCount={customGenVsaqCount}
            setCustomGenVsaqCount={setCustomGenVsaqCount}
            customGenSeqCount={customGenSeqCount}
            setCustomGenSeqCount={setCustomGenSeqCount}
            customGenOsceCount={customGenOsceCount}
            setCustomGenOsceCount={setCustomGenOsceCount}
            isGeneratingCustom={isGeneratingCustom}
            isGeneratingBatch={isGeneratingBatch}
            batchProgress={batchProgress}
            handleCustomGenerate={handleCustomGenerate}
            handleExportBank={handleExportBank}
            uploadDefaultYear={uploadDefaultYear}
            setUploadDefaultYear={setUploadDefaultYear}
            uploadDefaultPaper={uploadDefaultPaper}
            setUploadDefaultPaper={setUploadDefaultPaper}
            fileInputRef={fileInputRef}
            isUploading={isUploading}
            handleFileUpload={handleFileUpload}
            handleLoadAIBatch={handleLoadAIBatch}
            uploadStatus={uploadStatus}
            selectedBatchType={selectedBatchType}
            setSelectedBatchType={setSelectedBatchType}
            handleBatchGenerate={handleBatchGenerate}
            isPaused={isPaused}
            togglePause={togglePause}
            isFixingFaulty={isFixingFaulty}
            handleFixFaultyQuestions={handleFixFaultyQuestions}
            fixStatus={fixStatus}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            curriculumText={curriculumText}
            setCustomGenTopic={() => {}} /* Fallback for custom layouts */
            setCurriculumText={setCurriculumText}
            handleSaveCurriculum={handleSaveCurriculum}
            curriculumSaved={curriculumSaved}
            examGuidelines={examGuidelines}
            setExamGuidelines={setExamGuidelines}
            handleSaveGuidelines={handleSaveGuidelines}
            guidelinesSaved={guidelinesSaved}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsTab
            emailTemplates={emailTemplates}
            setEditingTemplate={setEditingTemplate}
          />
        )}

      </main>

      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSave={async (updatedQ) => {
            try {
              await updateQuestion(updatedQ);
              setEditingQuestion(null);
              await refreshBank();
            } catch (err: any) {
              customAlert(`Error saving question: ${err.message}`);
            }
          }}
        />
      )}
      {editingUser && (
        <EditUserModal 
          user={editingUser} 
          onSave={async (u) => {
            try {
              await updateUser(u);
              await refreshUsers();
              setEditingUser(null);
            } catch (e: any) {
              customAlert(`Error updating user: ${e.message}`);
            }
          }} 
          onClose={() => setEditingUser(null)} 
        />
      )}
      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={async (updatedTpl) => {
            try {
              const { updateEmailTemplate } = await import('../services/notificationService');
              await updateEmailTemplate(updatedTpl);
              await refreshEmailTemplates();
              setEditingTemplate(null);
            } catch (err: any) {
              customAlert(`Error saving template: ${err.message}`);
            }
          }}
        />
      )}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-hidden" onClick={() => setSelectedSubmission(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Submission Scorecard Detail</h3>
                <p className="text-xs text-slate-500 mt-1">{selectedSubmission.email} &bull; {new Date(selectedSubmission.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedSubmission(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Exam Format</span>
                  <span className="text-sm font-bold text-slate-800">{selectedSubmission.exam_type}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Score</span>
                  <span className="text-lg font-black text-indigo-600">{selectedSubmission.score} <span className="text-xs font-normal text-slate-400">/ {selectedSubmission.max_score} pts</span></span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Duration Taken</span>
                  <span className="text-sm font-bold text-slate-800">{selectedSubmission.time_taken}</span>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-2">Graded Questions Breakdown</h4>
                {selectedSubmission.answers?.questions?.map((q: any, idx: number) => {
                  let parsedFeedback: any = null;
                  try {
                    if (q.grading && q.grading.trim().startsWith('{')) {
                      parsedFeedback = JSON.parse(q.grading);
                    }
                  } catch (e) {}

                  return (
                    <div key={idx} className="border border-slate-200 rounded-lg p-5 space-y-4 bg-slate-50/50 shadow-sm animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-bold text-slate-900">{q.label} &bull; {q.topic}</span>
                        {parsedFeedback && (
                          <span className={`px-3 py-1 rounded text-xs font-black uppercase ${
                            parsedFeedback.passed ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            {parsedFeedback.passed ? `PASS (${parsedFeedback.candidateScore}/${parsedFeedback.totalPoints})` : `FAIL (${parsedFeedback.candidateScore}/${parsedFeedback.totalPoints})`}
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <strong className="text-xs uppercase text-slate-500 tracking-wider">Student's Input:</strong>
                        <div className="bg-white border rounded p-3 text-sm text-slate-800 font-mono overflow-x-auto">
                          {Object.entries(q.studentAnswers || {}).map(([subQId, text]: any) => (
                            <p key={subQId} className="mb-2 last:mb-0">
                              <span className="font-bold">Sub-Question {subQId}:</span> {text}
                            </p>
                          ))}
                          {Object.keys(q.studentAnswers || {}).length === 0 && <span className="italic text-slate-400">*(No answers submitted)*</span>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <strong className="text-xs uppercase text-slate-500 tracking-wider">AI Evaluation & Rubric:</strong>
                        <div className="bg-white border rounded p-4 text-sm prose prose-slate max-w-none">
                          {parsedFeedback ? (
                            <div className="space-y-4">
                              {parsedFeedback.timeCritique && (
                                <p className="text-xs font-semibold text-slate-500 bg-slate-50 p-2 rounded">⏱️ {parsedFeedback.timeCritique}</p>
                              )}
                              <div className="divide-y divide-slate-100">
                                {parsedFeedback.detailedRubric?.map((rub: any, rIdx: number) => (
                                  <div key={rIdx} className="py-2.5 flex items-start gap-3 text-xs">
                                    <span className={rub.checked ? 'text-green-500 font-bold' : 'text-red-400'}>
                                      {rub.checked ? '✓' : '✗'}
                                    </span>
                                    <div className="flex-1">
                                      <span className="font-semibold text-slate-800">{rub.criterion}</span>
                                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full ml-2 shrink-0">{rub.points} / {rub.maxPoints} pts</span>
                                      {rub.feedback && <p className="text-slate-400 mt-1">{rub.feedback}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap">{q.grading}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end">
              <button onClick={() => setSelectedSubmission(null)} className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-semibold text-sm transition">
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
