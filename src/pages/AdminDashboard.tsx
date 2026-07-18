import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, ShieldUser, Database, Upload, Users, Trash2, Loader2, Cpu, ChevronDown, ChevronUp, FileText, CheckCircle, Edit2, Mail, Save } from 'lucide-react';
import { parsePDFQuestionBank, getBank, saveBank, deleteQuestions, BankQuestion, getCurriculum, saveCurriculum, updateQuestion, generateFreshQuestions, getExamGuidelines, saveExamGuidelines, generateCustomBatch } from '../services/examEngine';
import { getUsers, addUser, updateUser, deleteUser, UserProfile } from '../services/userService';
import EditQuestionModal from '../components/EditQuestionModal';
import EditUserModal from '../components/EditUserModal';
import EditTemplateModal from '../components/EditTemplateModal';
import Markdown, { defaultUrlTransform } from 'react-markdown';

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
  const [aiModel, setAiModel] = useState('gemini-2.5-pro');
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
    setAiModel(localStorage.getItem('ranzco_ai_model') || 'gemini-2.5-pro');
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

  // Batch Generation State
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
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
    setIsGeneratingBatch(true);
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
          } catch (err) {
             const errorMessage = typeof err === 'string' ? err.toLowerCase() : JSON.stringify(err, Object.getOwnPropertyNames(err)).toLowerCase();
             if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('too many requests') || errorMessage.includes('resource_exhausted')) {
                retryCount++;
                if (retryCount >= 20) {
                  throw new Error(`Google AI API Quota Error after 20 retries. Try again later.`);
                }
                const backoffSeconds = 30 + (retryCount * 10);
                setBatchProgress(prev => ({ ...prev, waiting: true, waitTime: backoffSeconds }));
                await sleep(backoffSeconds * 1000);
                setBatchProgress(prev => ({ ...prev, waiting: false, waitTime: undefined }));
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
      setIsGeneratingBatch(false);
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
                setBatchProgress(prev => ({ ...prev, waiting: true, waitTime }));
                for (let s = waitTime; s > 0; s--) {
                   setBatchProgress(prev => ({ ...prev, waiting: true, waitTime: s }));
                   await sleep(1000);
                }
                setBatchProgress(prev => ({ ...prev, waiting: false }));
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
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-blue-600" />
                  <h3 className="text-lg font-bold text-slate-900">User Management</h3>
                </div>
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                  {usersData.length} Users
                </span>
              </div>
              <div className="p-6 border-b border-slate-100">
                <div className="flex gap-2">
                  <input 
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Invite user by email address..."
                    className="flex-grow border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <button 
                    onClick={handleAddUser}
                    className="bg-slate-900 text-white px-6 py-2 rounded-lg font-semibold hover:bg-slate-800 transition text-sm whitespace-nowrap"
                  >
                    Invite
                  </button>
                </div>
              </div>
              <div className="flex-grow overflow-y-auto max-h-[400px]">
                <ul className="divide-y divide-slate-100">
                  {usersData.map(u => (
                    <li key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-800 text-sm">{u.email}</p>
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${u.tier === 'pro' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                            {u.tier === 'pro' ? 'Pro' : 'Free'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 capitalize pr-4">
                          Role: <span className={u.role === 'admin' ? 'text-blue-600 font-bold' : ''}>{u.role}</span> | Joined: {u.joined} {u.tierExpiry ? `| Expires: ${u.tierExpiry}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingUser(u)}
                          className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition"
                          title="Edit User"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                          title="Remove User"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-900">Review Submissions</h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600 mb-4 text-sm">
                  View student performance, graded against the Angoff standard cut-scores automatically generated by the engine.
                </p>
                <div className="text-sm border border-slate-200 border-dashed p-8 rounded-lg text-center text-slate-400">
                  <p>No recent submissions.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bank' && (
          <div className="space-y-8">
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <Cpu className="w-6 h-6 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Custom Question Generator</h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600 mb-6 text-sm">
                  Generate specific questions by topic and type to fill gaps in your question bank.
                </p>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Topic</label>
                    <select 
                      value={customGenTopic}
                      onChange={(e) => setCustomGenTopic(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="All">All Topics (Mixed)</option>
                      <option value="Cataract">Cataract</option>
                      <option value="Cornea and External Eye">Cornea and External Eye</option>
                      <option value="Glaucoma">Glaucoma</option>
                      <option value="Neuro-ophthalmology">Neuro-ophthalmology</option>
                      <option value="Ocular Inflammation">Ocular Inflammation</option>
                      <option value="Ocular Motility">Ocular Motility</option>
                      <option value="Oculoplastics and Orbit">Oculoplastics and Orbit</option>
                      <option value="Paediatrics">Paediatrics</option>
                      <option value="Vitreoretinal">Vitreoretinal</option>
                    </select>
                  </div>
                  <div className="flex-[2] flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">VSAQ Count</label>
                      <input 
                        type="number" 
                        min="0" 
                        max="50" 
                        value={customGenVsaqCount}
                        onChange={(e) => setCustomGenVsaqCount(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                        className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">SEQ Count</label>
                      <input 
                        type="number" 
                        min="0" 
                        max="50" 
                        value={customGenSeqCount}
                        onChange={(e) => setCustomGenSeqCount(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                        className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">OSCE Count</label>
                      <input 
                        type="number" 
                        min="0" 
                        max="50" 
                        value={customGenOsceCount}
                        onChange={(e) => setCustomGenOsceCount(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                        className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <button 
                    onClick={handleCustomGenerate}
                    disabled={isGeneratingBatch}
                    className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50 min-w-[200px] flex items-center justify-center gap-2"
                  >
                    <Cpu className="w-5 h-5" /> Generate Questions
                  </button>
                  <button 
                    onClick={handleExportBank}
                    className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-emerald-700 transition min-w-[200px] flex items-center justify-center gap-2"
                  >
                    <FileText className="w-5 h-5" /> Download Entire Question Bank (JSON)
                  </button>
                </div>
                {isGeneratingBatch && (
                  <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                      <span className="font-medium text-indigo-900">
                        {batchProgress.waiting 
                          ? `Rate limit reached. Waiting ${batchProgress.waitTime}s before retrying...` 
                          : `Generating custom questions (${batchProgress.current} / ${batchProgress.total})...`
                        }
                      </span>
                    </div>
                    <div className="w-full bg-indigo-200 rounded-full h-2">
                      <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <Database className="w-6 h-6 text-purple-600" />
                <h3 className="text-lg font-bold text-slate-900">Upload to local Bank</h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                  Upload past questions below. They are stored safely in your <strong className="text-slate-800">PostgreSQL</strong> cloud database. The file must be a JSON array or a PDF document containing exam questions. (PDF extraction uses AI and may take a moment).
                </p>
                <div className="flex gap-4 mb-4 max-w-md">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Default Year</label>
                    <input 
                      value={uploadDefaultYear} 
                      onChange={e => setUploadDefaultYear(e.target.value)}
                      className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500"
                      placeholder="e.g. 2023"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Default Paper</label>
                    <input 
                      value={uploadDefaultPaper} 
                      onChange={e => setUploadDefaultPaper(e.target.value)}
                      className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500"
                      placeholder="e.g. Sem 1"
                    />
                  </div>
                </div>
                <div className="relative max-w-md">
                  <input 
                    type="file" 
                    accept=".json,.pdf"
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                    disabled={isUploading}
                    className={`absolute inset-0 w-full h-full opacity-0 ${isUploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  />
                  <div className={`bg-purple-50 border border-purple-200 text-purple-700 w-full py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 pointer-events-none ${isUploading ? 'opacity-70' : 'hover:bg-purple-100'}`}>
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    {isUploading ? 'Processing...' : 'Select JSON or PDF Document'}
                  </div>
                </div>
                
                <div className="mt-4 max-w-md border-t border-slate-100 pt-4">
                  <button 
                    onClick={handleLoadAIBatch}
                    disabled={isUploading}
                    className="w-full bg-slate-800 text-white py-3 rounded-lg font-semibold hover:bg-slate-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Cpu className="w-5 h-5" /> Load Pre-Generated Full Exams (Paper 1-4, OSCE) </button>
                  <p className="text-xs text-slate-500 mt-2 text-center">Contains 10 newly generated, highly detailed ophthalmology VSAQ & SEQ questions with images. Covers Paper 1, 2, 3, 4 and OSCE.</p>
                </div>

                {uploadStatus && (
                  <div className={`mt-4 p-3 rounded text-sm max-w-md ${uploadStatus.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    {uploadStatus}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <Cpu className="w-6 h-6 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Batch Generate Exam Simulations</h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600 mb-6 text-sm">
                  Automatically generate a complete set of questions for Paper 1, Paper 2, or OSCE and add them directly to the question bank. This process may take several minutes depending on AI limits.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-center max-w-xl">
                  <select 
                    value={selectedBatchType}
                    onChange={(e) => setSelectedBatchType(e.target.value as any)}
                    disabled={isGeneratingBatch}
                    className="w-full sm:w-auto flex-1 bg-white border border-slate-300 rounded-lg px-4 py-3 font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="paper1">Paper 1 (15 VSAQ, 5 SEQ)</option>
                    <option value="paper2">Paper 2 (15 VSAQ, 4 SEQ)</option>
                    <option value="paper3">Paper 3 (15 VSAQ, 5 SEQ)</option>
                    <option value="paper4">Paper 4 (15 VSAQ, 4 SEQ)</option>
                    <option value="osce">OSCE (18 Stations)</option>
                    <option value="full_exam">Full Exam (Papers 1-4 + OSCE)</option>
                  </select>
                  <button 
                    onClick={() => handleBatchGenerate(selectedBatchType)}
                    disabled={isGeneratingBatch}
                    className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
                  >
                    <Cpu className="w-5 h-5" />
                    {isGeneratingBatch ? 'Generating...' : 'Start Generation'}
                  </button>
                </div>
                {isGeneratingBatch && (
                  <div className="mt-4 p-4 bg-indigo-50 text-indigo-700 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm font-medium border border-indigo-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Loader2 className={`w-5 h-5 ${batchProgress.waiting && !isPaused ? '' : 'animate-spin'}`} />
                      {isPaused ? (
                        <span>Generation Paused. Click Resume to continue.</span>
                      ) : batchProgress.waiting ? (
                        <span>API Quota Hit. Waiting to resume: {batchProgress.waitTime}s... please do not close this window.</span>
                      ) : (
                        <span>Generating {batchProgress.current} of {batchProgress.total} questions... please do not close this window.</span>
                      )}
                    </div>
                    <button
                      onClick={togglePause}
                      className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg text-xs font-semibold shadow transition duration-150"
                    >
                      {isPaused ? 'Resume' : 'Pause'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                  <h3 className="text-lg font-bold text-slate-900">Database Maintenance</h3>
                </div>
              </div>
              <div className="p-6">
                <p className="text-slate-600 mb-6 text-sm">
                  Run a scan to find and rectify any faulty questions in your bank. This will scan for missing texts or questions that failed to fetch images ("Image Not Found"). The faulty questions will be deleted and automatically regenerated with fresh AI questions to ensure your database remains clean.
                </p>
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={handleFixFaultyQuestions}
                    disabled={isFixingFaulty}
                    className="self-start flex px-4 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition disabled:opacity-50 min-w-[200px] items-center justify-center"
                  >
                    {isFixingFaulty ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning...</>
                    ) : (
                      "Scan & Fix Faulty Questions"
                    )}
                  </button>
                  {fixStatus && (
                    <div className="p-4 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 shadow-sm text-sm font-medium flex items-center gap-2">
                      {isFixingFaulty && <Loader2 className="w-4 h-4 animate-spin" />}
                      {fixStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-900">Manage Question Bank</h3>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 mt-4 sm:mt-0">
                  <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1 rounded-md">
                    <select 
                      value={filterTopic} 
                      onChange={e => setFilterTopic(e.target.value)}
                      className="border-none rounded px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    >
                      <option disabled value="">Topic</option>
                      {uniqueTopics.map(t => <option key={t} value={t}>{t === 'All' ? 'All Topics' : t}</option>)}
                    </select>
                    <select 
                      value={filterPaper} 
                      onChange={e => setFilterPaper(e.target.value)}
                      className="border-none rounded px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    >
                      <option disabled value="">Paper</option>
                      {uniquePapers.map(p => <option key={p} value={p}>{p === 'All' ? 'All Papers' : p}</option>)}
                    </select>
                    <select 
                      value={filterYear} 
                      onChange={e => setFilterYear(e.target.value)}
                      className="border-none rounded px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    >
                      <option disabled value="">Year</option>
                      {uniqueYears.map(y => <option key={y} value={y}>{y === 'All' ? 'All Years' : y}</option>)}
                    </select>
                    <select 
                      value={filterType} 
                      onChange={e => setFilterType(e.target.value)}
                      className="border-none rounded px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    >
                      <option disabled value="">Type</option>
                      {uniqueTypes.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
                    </select>
                  </div>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="yearDesc">Sort By: Reverse Chronological (Newest First)</option>
                    <option value="yearAsc">Sort By: Chronological (Oldest First)</option>
                    <option value="topicAsc">Sort By: Topic (A-Z)</option>
                    <option value="topicDesc">Sort By: Topic (Z-A)</option>
                    <option value="typeAsc">Sort By: Type (A-Z)</option>
                    <option value="typeDesc">Sort By: Type (Z-A)</option>
                  </select>
                  {(filterTopic !== 'All' || filterYear !== 'All' || filterPaper !== 'All' || filterType !== 'All' || sortBy !== 'yearAsc') && (
                    <button
                      onClick={() => {
                        setFilterTopic('All');
                        setFilterYear('All');
                        setFilterPaper('All');
                        setFilterType('All');
                        setSortBy('yearAsc');
                      }}
                      className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded font-medium transition text-xs"
                    >
                      Clear Filters
                    </button>
                  )}
                  <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1.5 rounded uppercase tracking-wide">
                    {filteredBank.length} Qs
                  </span>
                </div>
              </div>

              <div className="p-0">
                {filteredBank.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <p>No questions match your filters or the bank is empty.</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-slate-50 border-b border-slate-100 p-3 flex items-center justify-between text-sm">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={selectedQuestions.length === filteredBank.length && filteredBank.length > 0}
                          onChange={() => toggleSelectAll(filteredBank.map(q => q.id))}
                        />
                        Select All
                      </label>
                      
                      {selectedQuestions.length > 0 && (
                        <div className="flex items-center">
                          <button 
                            onClick={handleBulkDelete}
                            className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded font-medium transition flex items-center gap-1 text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete {selectedQuestions.length} Selected
                          </button>
                          <button 
                            onClick={handleDownloadPrintable}
                            className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded font-medium transition flex items-center gap-1 text-xs ml-2"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Download {selectedQuestions.length} Selected (Text)
                          </button>
                        </div>
                      )}
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {paginatedBank.map((q) => {
                        const isExpanded = expandedQuestionId === q.id;
                        const isSelected = selectedQuestions.includes(q.id);
                        return (
                          <li key={q.id} className="p-4 flex flex-col hover:bg-slate-50 transition">
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelection(q.id)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-0.5 self-start"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer" onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}>
                                <div className="flex items-center gap-3 flex-wrap">
                                  {q.questionLabel && <span className="font-bold text-slate-900 text-sm">{q.questionLabel}</span>}
                                  <span className={`px-2 py-0.5 text-xs font-bold rounded ${q.type === 'SEQ' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>{q.type}</span>
                                  <span className="text-sm font-medium text-slate-800">{q.topic}</span>
                                  {q.year && q.year !== 'Unknown' && <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">{q.year}</span>}
                                  {q.paper && q.paper !== 'Unknown' && <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">{q.paper}</span>}
                                  {q.used && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Used</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setEditingQuestion(q); }}
                                    className="text-slate-400 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition text-sm font-medium"
                                    title="Edit Question"
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteFromBank(q.id); }}
                                    className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                                    title="Delete Question"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                  {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                                </div>
                              </div>
                            </div>
                          
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-slate-100 pl-2 cursor-default" onClick={e => e.stopPropagation()}>
                              <div className="bg-slate-50 p-4 rounded-lg mb-4 text-sm prose prose-slate max-w-none prose-sm">
                                <strong className="text-slate-700 block mb-2">Scenario:</strong>
                                <div><Markdown urlTransform={customUrlTransform} components={MarkdownComponents}>{q.data.scenario}</Markdown></div>
                              </div>
                              
                              <div className="space-y-4 text-sm">
                                <strong className="text-slate-700 block mb-2">Questions & Model Answers:</strong>
                                {q.data.subQuestions?.map((sq: any, i: number) => (
                                  <div key={sq.id || i} className="bg-white border text-sm border-slate-200 p-3 rounded shadow-sm">
                                    <p className="font-medium text-slate-800 mb-3">Q: {sq.text}</p>
                                    <div className="bg-green-50/50 border border-green-100 text-green-900 p-3 rounded h-full">
                                      <span className="font-semibold text-green-800 text-xs uppercase tracking-wider block mb-2">Model Answer:</span>
                                      <div>{sq.modelAnswer ? <Markdown urlTransform={customUrlTransform} components={MarkdownComponents}>{sq.modelAnswer}</Markdown> : <span className="italic text-slate-500 opacity-80">Not provided by AI extraction. It will be generated on the fly by the AI assessor during exam.</span>}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200 sm:px-6">
                      <div className="flex justify-between flex-1 sm:hidden">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-slate-700">
                            Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredBank.length)}</span> of <span className="font-medium">{filteredBank.length}</span> results
                          </p>
                        </div>
                        <div>
                          <nav className="inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                            <button
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                            >
                              <span className="sr-only">Previous</span>
                              &larr;
                            </button>
                            {Array.from({ length: totalPages }).map((_, i) => (
                              <button
                                key={i}
                                onClick={() => setCurrentPage(i + 1)}
                                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 ${
                                  currentPage === i + 1 
                                    ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                                    : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                {i + 1}
                              </button>
                            ))}
                            <button
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                            >
                              <span className="sr-only">Next</span>
                              &rarr;
                            </button>
                          </nav>
                        </div>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto">


            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <FileText className="w-6 h-6 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Curriculum Framework</h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600 mb-4 text-sm">
                  Upload or paste the curriculum framework for the exam. The AI engine will utilize this to set examination boundaries, verify syllabus matches when generating questions, and evaluate candidates accurately.
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
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition text-sm whitespace-nowrap"
                  >
                    Save Curriculum Guide
                  </button>
                  {curriculumSaved && <span className="text-sm text-indigo-600 font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Saved!</span>}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <FileText className="w-6 h-6 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Exam Guidelines & Format</h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600 mb-4 text-sm">
                  Define the exact internal format of the exam, including timing rules, papers, durations, mark allocations, scoring standards, and logistical instructions.
                </p>
                <textarea
                  className="w-full border border-slate-300 rounded-lg p-4 text-sm h-64 focus:ring-2 focus:ring-indigo-500 outline-none resize-y font-mono"
                  placeholder="Paste exam formatting and logistical guidelines..."
                  value={examGuidelines}
                  onChange={e => setExamGuidelines(e.target.value)}
                />
                <div className="pt-4 flex items-center gap-4">
                  <button 
                    onClick={handleSaveGuidelines}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition text-sm whitespace-nowrap"
                  >
                    Save Exam Guidelines
                  </button>
                  {guidelinesSaved && <span className="text-sm text-indigo-600 font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Saved!</span>}
                </div>
              </div>
            </div>


          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-6 h-6 text-blue-600" />
                  <h3 className="text-lg font-bold text-slate-900">Email Templates</h3>
                </div>
              </div>
              <div className="p-6">
                <p className="text-slate-600 mb-6 text-sm">
                  Manage automated email notifications sent to users on key events. You can enable/disable these and modify their subject and body text. Use {'{{variable}}'} tags to inject dynamic content.
                </p>
                <div className="space-y-4">
                  {emailTemplates.map(template => (
                    <div key={template.id} className="border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row justify-between gap-4 bg-slate-50 hover:bg-slate-100/50 transition">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-bold text-slate-800">{template.name}</h4>
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${template.enabled ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}>
                            {template.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-slate-500 mb-2">ID: {template.id}</p>
                        <p className="text-sm text-slate-700"><span className="font-medium">Subject:</span> {template.subject}</p>
                      </div>
                      <div className="flex items-end sm:items-center">
                        <button 
                          onClick={() => setEditingTemplate(template)}
                          className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium transition text-sm flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit Template
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
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
    </div>
  );
}
