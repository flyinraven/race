import { GoogleGenAI } from '@google/genai';
import { jsonrepair } from 'jsonrepair';
import { get, set } from 'idb-keyval';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

let aiInstance: GoogleGenAI | null = null;
let currentKey = '';

export function getAiConfig() {
  const customKey = localStorage.getItem('ranzco_api_key');
  const apiKey = customKey || process.env.GEMINI_API_KEY || '';
  const modelName = localStorage.getItem('ranzco_ai_model') || 'gemini-2.5-flash';
  const provider = localStorage.getItem('ranzco_ai_provider') || 'google';
  return { apiKey, modelName, provider };
}

// Per-task model storage keys
export type AiTask = 'generation' | 'grading' | 'parsing' | 'optimization';
export const TASK_MODEL_KEYS: Record<AiTask, string> = {
  generation:   'ranzco_model_generation',
  grading:      'ranzco_model_grading',
  parsing:      'ranzco_model_parsing',
  optimization: 'ranzco_model_optimization',
};

/** Returns the model for a specific task, falling back to the global default. */
export function getTaskModel(task: AiTask): string {
  const global = localStorage.getItem('ranzco_ai_model') || 'gemini-2.5-flash';
  return localStorage.getItem(TASK_MODEL_KEYS[task]) || global;
}

function getAiClient() {
  const { apiKey } = getAiConfig();
  if (!aiInstance || currentKey !== apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
    currentKey = apiKey;
  }
  return aiInstance;
}

const cleanJsonText = (str: string) => {
  return str.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
};

async function callAI(parts: any[], config: any, modelOverride?: string) {
  const customKey = localStorage.getItem('ranzco_api_key');
  const provider = localStorage.getItem('ranzco_ai_provider') || 'google';
  const modelName = localStorage.getItem('ranzco_ai_model') || 'gemini-2.5-flash';
  const selectedModel = modelOverride || modelName;

  const formattedParts = parts.map(p => {
    if (typeof p === 'string') return { text: p };
    return p;
  });

  try {
    const data = await apiFetch('/ai/generate', {
      method: 'POST',
      body: JSON.stringify({
        parts: formattedParts,
        config,
        modelOverride: selectedModel,
        provider,
        customKey
      })
    });
    return cleanJsonText(data.text || "");
  } catch (e: any) {
    throw new Error(e.message || "AI generation failed");
  }
}

export async function getExamGuidelines(): Promise<string> {
  const localVal = await get('ranzco_exam_guidelines');
  if (localVal) return localVal;

  if (true) {
    try {
      const { data, error } = await apiFetch('/settings/exam_guidelines').then(res => ({ data: res, error: null })).catch(err => ({ data: null, error: err }));
      if (!error && data) {
        await set('ranzco_exam_guidelines', data.value);
        return data.value;
      }
    } catch (e) {
      console.error('Supabase fetch exam guidelines failed:', e);
    }
  }
  
  // Default RACE format based on user provided instructions
  return `Eligible candidates will complete four papers conducted over two consecutive days. Each paper consists of two parts. The questions are comprised of SEQ (Short Essay Question) and VSAQ (Very Short Answer Question):

Part A consists of 4 or 5 SEQs
Part B consists of 15 VSAQs.

The duration of each day (two papers) is 4 hours and 10 minutes, including 40 minutes preparation time and 30 minutes supervised break after the first session. It is completed online.

Time Allocation
Day 1
Paper 1 5 SEQ + 15 VSAQ Writing time: 1 hour 40 min
Paper 2 4 SEQ + 15 VSAQ Writing time: 1 hour 20 min
Total 3 hours (180 minutes)

Day 2
Paper 3 5 SEQ + 15 VSAQ Writing time: 1 hour 40 min
Paper 4 4 SEQ + 15 VSAQ Writing time: 1 hour 20 min
Total 3 hours (180 minutes)

Mark Allocation
Each SEQ is worth 20 marks and is marked by two examiners.
Each VSAQ is worth 2 marks and is marked by two examiners.

Time allocation according to marks:
1 SEQ = 15 mins per question
1 VSAQ = 1.5 mins per question

Paper 1:
00:00-00:05 (5 min) Preparation / Desktop check
00:05-00:20 (15 min) Notes / Reading time
00:20-02:00 (1 hour 40 min) Answer first 5 SEQ and 15 VSAQ

Supervised rest break
02:00-02:30 (30 min)

Paper 2:
02:30-02:35 (5 min) Preparation
02:35-02:50 (15 min) Notes / Reading time
02:50-04:10 (1 hour 20 min) Answer last 4 SEQ and 15 VSAQ

The clinical component involves an Objective Structured Clinical Examination (OSCE) over two days. Candidates work through 18 stations, with each station examining specific clinical curriculum performance standards. Each station is 9 minutes.

STANDARD SETTING:
All questions are set using the Angoff Standards Setting process that considers the difficulty of each question as well as variations in difficulty across different exams. Each exam has a cut score based on this principle.`;
}

export async function saveExamGuidelines(text: string) {
  try {
    await set('ranzco_exam_guidelines', text);
    if (true) {
      await apiFetch('/settings', { method: 'POST', body: JSON.stringify({ id: 'exam_guidelines', value: text }) });
    }
  } catch (e) {
    console.error('Save exam guidelines failed:', e);
  }
}

export async function getCurriculum(): Promise<string> {
  const localVal = await get('ranzco_curriculum');
  if (localVal) return localVal;

  if (true) {
    try {
      const { data, error } = await apiFetch('/settings/curriculum').then(res => ({ data: res, error: null })).catch(err => ({ data: null, error: err }));
      if (!error && data) {
        await set('ranzco_curriculum', data.value);
        return data.value;
      }
    } catch (e) {
      console.error('Supabase fetch curriculum failed:', e);
    }
  }
  return '';
}

export async function saveCurriculum(text: string) {
  try {
    await set('ranzco_curriculum', text);
  } catch(e) {
    console.error("Failed to save curriculum to IDB", e);
  }
  
  if (true) {
    try {
      await apiFetch('/settings', { method: 'POST', body: JSON.stringify({ id: 'curriculum', value: text }) });
    } catch (e) {
      console.error("Failed to sync curriculum to Supabase", e);
    }
  }
}

export interface CurriculumDoc {
  id: string;
  topic: string;
  filename: string;
  year: string;
  created_at: string;
}

export async function getCurriculumDocs(): Promise<CurriculumDoc[]> {
  try {
    return await apiFetch('/admin/curriculum-docs');
  } catch (error) {
    console.error('getCurriculumDocs error:', error);
    return [];
  }
}

export async function uploadCurriculumDoc(doc: { topic: string; filename: string; year: string; text_content: string }): Promise<CurriculumDoc> {
  return await apiFetch('/admin/curriculum-docs', {
    method: 'POST',
    body: JSON.stringify(doc)
  });
}

export async function deleteCurriculumDoc(id: string): Promise<boolean> {
  try {
    await apiFetch(`/admin/curriculum-docs/${id}`, { method: 'DELETE' });
    return true;
  } catch (error) {
    console.error('deleteCurriculumDoc error:', error);
    return false;
  }
}


import { topicCurriculums } from '../data/curriculums';

async function getSystemPrompt(topics?: string | string[], skipCurriculum: boolean = false) {
  const globalCurriculum = skipCurriculum ? '' : await getCurriculum();
  const examGuidelines = await getExamGuidelines();
  
  let curriculumText = `Curriculum Core Topics: Cataract, Cornea, Glaucoma, Neuro-ophthalmology, Ocular Inflammation, Ocular Motility, Oculoplastics, Paediatrics, Vitreoretinal`;
  
  if (!skipCurriculum) {
    try {
      if (Array.isArray(topics)) {
        const outlines = await Promise.all(topics.map(async t => {
          const dbRes = await apiFetch(`/curriculum-text/${encodeURIComponent(t)}`);
          if (dbRes?.text && dbRes.text.trim().length > 0) {
            return `Topic: ${t}\n${dbRes.text}`;
          }
          // Fallback to static data
          if (topicCurriculums[t]) {
            return `Topic: ${t}\n${topicCurriculums[t]}`;
          }
          return '';
        }));
        const matched = outlines.filter(Boolean);
        if (matched.length > 0) {
          curriculumText = `Curriculum Framework for this batch:\n\n` + matched.join('\n\n');
        }
      } else if (topics && topics !== 'combined' && topics !== 'All') {
        const dbRes = await apiFetch(`/curriculum-text/${encodeURIComponent(topics)}`);
        if (dbRes?.text && dbRes.text.trim().length > 0) {
          curriculumText = `Curriculum Framework for ${topics}:\n${dbRes.text}`;
        } else if (topicCurriculums[topics]) {
          curriculumText = `Curriculum Framework for ${topics}:\n${topicCurriculums[topics]}`;
        }
      } else if (topics === 'combined' || topics === 'All') {
        // Fetch all docs from backend
        const dbDocs = await apiFetch('/curriculum-text');
        if (Array.isArray(dbDocs) && dbDocs.length > 0) {
          // Group by topic
          const groups: Record<string, string[]> = {};
          dbDocs.forEach(d => {
            if (!groups[d.topic]) groups[d.topic] = [];
            groups[d.topic].push(`--- (${d.year}) ---\n${d.text_content}`);
          });
          const compiled = Object.entries(groups).map(([t, contents]) => `Topic: ${t}\n${contents.join('\n\n')}`).join('\n\n');
          curriculumText = `Combined Curriculum Framework:\n\n${compiled}`;
        } else {
          // Fallback to static combined
          const allTopics = Object.entries(topicCurriculums).map(([k, v]) => `Topic: ${k}\n${v}`).join('\n\n');
          curriculumText = `Combined Curriculum Framework:\n\n${allTopics}`;
        }
      } else if (globalCurriculum && globalCurriculum.trim().length > 0) {
        curriculumText = `Curriculum Framework:\n${globalCurriculum}`;
      }
    } catch (err) {
      console.warn("Failed to retrieve dynamic curriculum outlines, using static fallbacks.", err);
      // Simple fallback logic if backend fails
      if (topics && topics !== 'combined' && topics !== 'All' && !Array.isArray(topics) && topicCurriculums[topics]) {
        curriculumText = `Curriculum Framework for ${topics}:\n${topicCurriculums[topics]}`;
      }
    }
  } else {
    curriculumText = "RANZCO RACE Curriculum Outline (Syllabus reference skipped for efficiency).";
  }

  return `You are the "RANZCO RACE Exam Engine & Assessor", a backend AI generating and grading Fellowship-level Ophthalmology exams.
Base questions/grading strictly on the curriculum below. Do not test outside these boundaries.

${curriculumText}

RACE EXAM FORMAT GUIDELINES:
${examGuidelines}

Execute the triggered command from the bracketed inputs:

MODE 1: [GENERATE_QUESTION_BATCH]
Input: Type (VSAQ/SEQ/OSCE), Topic, Count.
Action: Generate Count unique questions for type and topic.

For VSAQ:
- Rules: 1.5-minute fellowship question. Single-sentence clinical stem, direct factual answer expected.
- Format: scenario = the clinical stem, one subQuestion with the question text and concise model answer.

For SEQ:
- Rules: 15-minute fellowship question. Rich multi-part case with comprehensive patient workup.
- Use "![Image](SEARCH_IMAGE:<pathology_name>)" for clinical images. The search query MUST be the specific name of the eye pathology (e.g. "nuclear cataract lens", "corneal ulcer", "disc cupping"). NEVER include words like "examination", "slit lamp", "performing", "doctor", "testing", or "procedure" as they retrieve stock photos of machines and people.
- Break into 4-6 sub-questions with mark allocations (e.g. "a) What is the most likely diagnosis? (2 marks)").
- Model answers: Detail matching a competent Australian ophthalmologist.

For OSCE:
- Rules: Simulate a real RANZCO OSCE verbal station. Each station is exactly 9 minutes, examiner-led.
- The OSCE station MUST follow this strict real-world RANZCO format:
  * The scenario is a PATIENT ENCOUNTER card. It describes the patient history (age, gender, optometrist findings) and states the examiner's initial instructions to the candidate, e.g. "Examiner: This is Julie, a 48-year-old female. Please perform a posterior segment examination and verbally state your findings."
  * Use "![Image](SEARCH_IMAGE:<pathology_name>)" to embed ONE relevant clinical image (e.g. "papilledema disc", "toxoplasmosis scar", "thyroid proptosis", "angioid streaks"). The search query MUST target the specific clinical pathology/findings directly. NEVER include generic procedure words like "examination", "slit-lamp", "performing", "doctor", or "testing" as they fetch stock photos of clinical rooms instead of the pathological eye signs.
  * Sub-questions are asked VERBALLY by the examiner and represent the following strict clinical progression:
    a) Description of findings: Candidate's verbal list of signs (e.g. "What key findings do you see, and what negative signs differentiate this from choroidal melanoma?") [3 marks]
    b) Differential Diagnosis & Primary Diagnosis (e.g. "What is your diagnosis and the key differentials?") [2 marks]
    c) Investigations: Ancillary tests needed, e.g. FFA, ICG, visual field [2 marks]
    d) Management algorithm (acute and chronic, surgical options, referrals) [3 marks]
    e) Complications, prognosis, or patient counselling [2 marks]
  * Each sub-question must have mark allocation in brackets (e.g. "(2 marks)", "(3 marks)").
  * Total marks for the station = 10-15 marks.
  * Model answers for OSCE must be CONCISE spoken-style responses (as a candidate would say them aloud to the examiner), not long essays.

Format: Raw JSON array of Question Objects:
[
  {
    "scenario": "**OSCE Station — [Topic]:**\\n\\n**Patient History:** [age]-year-old [gender] presenting with [history].\\n\\n**Examiner Instructions:** \\\"This is [Name]. Please perform a [examination type] segment examination and verbally state your findings.\\\"\\n\\n![Image](SEARCH_IMAGE:<pathology_query>)",
    "subQuestions": [
      { "id": "q1", "text": "a) [Question text]? ([N] marks)", "modelAnswer": "Concise spoken-style answer..." },
      { "id": "q2", "text": "b) [Question text]? ([N] marks)", "modelAnswer": "Concise spoken-style answer..." }
    ]
  }
]

MODE 2: [GRADE_ANSWER]
Input: User Answers, Time Taken, Target Time, Question Context.
Action: Grade using points-based system & Angoff Standard.
Format: Raw JSON Object ONLY (no markdown wraps, no \`\`\`json):
{
  "timeCritique": "Compare time taken to target...",
  "totalPoints": 10,
  "angoffPassMark": 6,
  "candidateScore": 8,
  "passed": true,
  "detailedRubric": [
    { "criterion": "Criterion description", "points": 1, "maxPoints": 2, "feedback": "Feedback for this criterion", "checked": true }
  ],
  "generalFeedback": "Summary critique of style, omissions, and structure..."
}

MODE 3: [PARSE_PDF_BANK]
Input: PDF exam questions, past papers, examiner reports, or copy-pasted raw question transcripts generated by external AI chat interfaces.
Action: Parse into standard JSON structure. You MUST automatically extract or infer the exam year (e.g., "2023" or "2025") and paper/semester (e.g., "Paper 1" or "Semester 2") from the document header, text, or metadata. If not found, default to the current year and "Past Exam". Correctly extract questions, sub-questions, and model answers (if model answers are omitted or empty in the input text, you MUST generate high-quality ophthalmic fellowship level model answers for them).
Format: Raw JSON array:
[
  {
    "type": "VSAQ", "topic": "Glaucoma", "paper": "Paper 1", "year": "2023", "questionLabel": "Q1",
    "data": { "scenario": "**Clinical Scenario:**\\n<text>", "subQuestions": [{ "id": "q1", "text": "text", "modelAnswer": "ans" }] }
  }
]

MODE 5: [GENERATE_CUSTOM_BATCH]
Input: JSON list of specs (specId, type, topic, label, paperName).
Action: Generate exactly one unique question for each spec.
Rules: Same as MODE 1, including OSCE-specific rules above for OSCE type specs.
Format: Raw JSON array (no markdown wraps, no \`\`\`json):
[
  {
    "specId": "id",
    "data": {
      "scenario": "**OSCE Station — [Topic]:**\\n\\n<patient encounter card>\\n\\n![Image](SEARCH_IMAGE:<query>)",
      "subQuestions": [
        { "id": "q1", "text": "a) Question? (N marks)", "modelAnswer": "Concise spoken answer..." }
      ]
    }
  }
]

MODE 4: [OPTIMIZE_MODEL_ANSWER]
Input: Question text, Current Model Answer, Optimization Request.
Action: Enhance/rewrite model answer as instructed. Return raw improved text ONLY (no conversational filler).`;
}

const BANK_KEY = 'ranzco_exam_bank';

import { apiFetch } from '../lib/apiClient';
import { extractImagesFromPDF } from '../lib/pdfExtractor';

export interface BankQuestion {
  id: string;
  specId?: string;
  type: string;
  topic: string;
  paper?: string;
  year?: string | number;
  questionLabel?: string;
  data: any;
  used: boolean;
  created_at?: string;
}

export function getBookmarks(): string[] {
  try {
    return JSON.parse(localStorage.getItem('ranzco_bookmarks') || '[]');
  } catch (e) {
    return [];
  }
}

export function toggleBookmark(id: string): boolean {
  const bookmarks = getBookmarks();
  const index = bookmarks.indexOf(id);
  if (index > -1) {
    bookmarks.splice(index, 1);
  } else {
    bookmarks.push(id);
  }
  localStorage.setItem('ranzco_bookmarks', JSON.stringify(bookmarks));
  return index === -1; // return true if it is now bookmarked
}

export function isBookmarked(id: string): boolean {
  return getBookmarks().includes(id);
}

export async function getBank(): Promise<BankQuestion[]> {
  if (true) {
    try {
      const data = await apiFetch('/questions').catch(() => null); const error = !data ? { message: 'Fetch failed' } : null;
      if (error) {
        console.error('Supabase getBank error:', error.message);
      } else if (data) {
        try {
          await set(BANK_KEY, JSON.stringify(data));
        } catch (e) {
          console.error("Failed to cache bank locally:", e);
        }
        return data;
      }
    } catch (e) {
      console.error('Supabase fetch failed:', e);
    }
  }
  
  let bankStr: string | undefined;
  try {
    bankStr = await Promise.race([
      get<string>(BANK_KEY),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("IndexedDB read timeout")), 5000))
    ]);
  } catch (err) {
    console.warn("Could not read from IndexedDB:", err);
    bankStr = undefined;
  }
  
  let results: BankQuestion[] = bankStr ? JSON.parse(bankStr) : [];
  
  if (results.length === 0) {
    try {
      const resp = await fetch('/ai_batch.json');
      if (resp.ok) {
        const fallback = await resp.json();
        if (Array.isArray(fallback) && fallback.length > 0) {
          results = fallback;
          await set(BANK_KEY, JSON.stringify(results));
        }
      }
    } catch (e) {
      console.warn("Could not load fallback ai_batch.json", e);
    }
  }

  let needsResave = false;
  results = results.map(q => {
    let cleanQ = q;
    
    if (cleanQ.data && cleanQ.data.scenario) {
        let modified = false;
        let newScenario = cleanQ.data.scenario;

        // 1. Strip trailing hallucinated ))}) artifacts
        if (newScenario.includes('))})')) {
            newScenario = newScenario.replace('))})', ')');
            modified = true;
        }

        // 2. Fix unencoded spaces in placehold.co images OR replace wikimedia commons links
        if (newScenario.match(/\!\[Image\]\((https?:\/\/[^\)\n]+)\)/g)) {
            newScenario = newScenario.replace(/\!\[Image\]\((https?:\/\/[^\)\n]+)\)/g, (match, url) => {
                if (url.includes('placehold.co') && url.includes(' ')) {
                    modified = true;
                    return '![Image](' + url.replace(/ /g, '%20') + ')';
                }
                return match;
            });
        }

        if (modified) {
            cleanQ = { ...cleanQ, data: { ...cleanQ.data, scenario: newScenario } };
            needsResave = true;
        }
    }

    if (!cleanQ.id) {
      needsResave = true;
      return { ...cleanQ, id: Math.random().toString(36).substring(2, 15) };
    }
    return cleanQ;
  });
  
  if (needsResave) {
    set(BANK_KEY, JSON.stringify(results)).catch(e => console.error(e));
  }
  
  return results;
}

export async function saveBank(bank: BankQuestion[]) {
  // Strip ephemeral fields not present in Supabase schema
  const cleanBank = bank.map(q => {
    const { specId, ...rest } = q;
    return rest;
  });

  // Always save locally to ensure fast UX
  try {
    await Promise.race([
      set(BANK_KEY, JSON.stringify(cleanBank)),
      new Promise((_, reject) => setTimeout(() => reject(new Error("IndexedDB save timeout")), 5000))
    ]);
  } catch(e) {
    console.error("Failed to save bank locally (Quota Exceeded?):", e);
    throw new Error("Unable to save to Local Storage (Quota Exceeded). File is too large, or browser storage is full.");
  }

  if (true) {
    try {
      await apiFetch('/questions/upsert', { method: 'POST', body: JSON.stringify(cleanBank) }); const error = null;
      if (error) {
        console.error('Supabase saveBank error:', error.message);
        throw new Error(`Supabase error: ${error.message}`);
      }
    } catch (e: any) {
      console.error("Failed to sync bank to Supabase", e);
      throw new Error(`Failed to sync to DB: ${e.message}`);
    }
  }
}

export async function deleteQuestions(ids: string[]) {
  // Attempt Supabase
  if (true) {
    try {
      await apiFetch('/questions/delete', { method: 'POST', body: JSON.stringify({ ids }) }); const error = null;
      if (error) {
        console.error('Supabase delete error:', error.message);
      }
    } catch (e: any) {
      console.error('Supabase delete exception:', e);
    }
  }

  // Save locally
  try {
    const bankStr = await get<string>(BANK_KEY);
    const bank = bankStr ? JSON.parse(bankStr) : [];
    const updated = bank.filter((q: BankQuestion) => !ids.includes(q.id));
    await set(BANK_KEY, JSON.stringify(updated));
  } catch(e) {
    console.error("Local storage error:", e);
  }
}


async function processSearchImages(dataObj: any) {
    if (!dataObj || !dataObj.scenario) return;
    
    // Scrub hallucinated URLs
    if (dataObj.scenario.match(/\!\[Image\]\(https?:\/\/[^\)\n]+\)/ig)) {
        dataObj.scenario = dataObj.scenario.replace(/\!\[Image\]\((https?:\/\/[^\)\n]+)\)/ig, (match, url) => {
            if (url.includes('placehold.co')) return match; 
            return match; // Keep existing image if not placeholder
        });
    }

    if (dataObj.scenario.includes('SEARCH_IMAGE:')) {
        const regex = /SEARCH_IMAGE:([^)"'\]]+)/g;
        let match;
        let newScenario = dataObj.scenario;
        while ((match = regex.exec(dataObj.scenario)) !== null) {
            const query = match[1].replace(/\+/g, ' ');
            const imageUrl = await fetchCommonsImage(query);
            newScenario = newScenario.replace(`SEARCH_IMAGE:${match[1]}`, imageUrl);
        }
        
        // Scrub any new hallucinated direct URLs
        if (newScenario && newScenario.match(/\!\[Image\]\(https?:\/\/[^\)\n]+\)/g)) {
            newScenario = newScenario.replace(/\!\[Image\]\((https?:\/\/[^\)\n]+)\)/g, (match, url) => {
                if (url.includes('placehold.co')) return match; 
                return match;
            });
        }
        dataObj.scenario = newScenario;
    }
}

export async function parsePDFQuestionBank(pdfBase64: string, fileName: string, defaultYear?: string, defaultPaper?: string, onProgress?: (msg: string) => void): Promise<BankQuestion[]> {
  const timeoutPromise = new Promise<BankQuestion[]>((_, reject) => 
    setTimeout(() => reject(new Error("Global PDF processing timeout (10 minutes). PDF is too complex or API is unresponsive. Try uploading fewer pages at a time.")), 600000)
  );

  const processingPromise = async () => {
    onProgress?.("Loading PDF and extracting text...");
    
    const pdfData = atob(pdfBase64.split('base64,').pop() || pdfBase64);
    const uint8Array = new Uint8Array(pdfData.length);
    for (let i = 0; i < pdfData.length; i++) {
        uint8Array[i] = pdfData.charCodeAt(i);
    }
    
    const doc = await pdfjsLib.getDocument({data: uint8Array}).promise;
    const pageTexts: string[] = [];
    
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      onProgress?.(`Extracting text from page ${pageNum} of ${doc.numPages}...`);
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      pageTexts.push(`--- Page ${pageNum} ---\n${pageText}\n\n`);
    }
    
    onProgress?.("Extracting clinical images from PDF (this may take up to 2 minutes)...");
    const extractedImages = await extractImagesFromPDF(pdfBase64);
    
    // Parse in chunks of 5 pages
    const chunkSize = 5;
    let combinedQuestions: any[] = [];
    
    for (let i = 0; i < pageTexts.length; i += chunkSize) {
      const chunkIndex = Math.floor(i / chunkSize) + 1;
      const totalChunks = Math.ceil(pageTexts.length / chunkSize);
      onProgress?.(`Sending page chunk ${chunkIndex} of ${totalChunks} to AI for extraction...`);
      
      const chunkText = pageTexts.slice(i, i + chunkSize).join('\n');
      
      const parts = [
        `[PARSE_PDF_BANK]\nThis is a portion of a past exam paper PDF. Extract all questions from this text, map them to one of the 9 core topics, and format them as the specified JSON array structure. Keep any ImageIndex_X placeholders intact if images are referenceable.\nSource File: "${fileName}".\nDefault Year: ${defaultYear || 'AI'}. Default Paper: ${defaultPaper || 'Paper'}.\n\nText Content:\n${chunkText}`
      ];
      
      if (extractedImages.length > 0) {
        parts.push(`\n\n--- EXTRACTED IMAGES (${extractedImages.length} images) ---`);
        extractedImages.forEach((imgB64, imgIdx) => {
          const rawData = imgB64.indexOf('base64,') > -1 ? imgB64.split('base64,').pop() : imgB64;
          if (rawData) {
            parts.push(`\nImageIndex_${imgIdx}:`);
            parts.push({ inlineData: { mimeType: "image/jpeg", data: rawData } });
          }
        });
      }
      
      const parsedText = await callAI(parts, {
        systemInstruction: await getSystemPrompt(undefined, true),
        temperature: 0.1,
        responseMimeType: "application/json"
      }, getTaskModel('parsing'));
      
      let chunkQuestions: any[] = [];
      try {
        chunkQuestions = JSON.parse(parsedText || "[]");
      } catch (e) {
        try {
          const repaired = jsonrepair(parsedText || "[]");
          chunkQuestions = JSON.parse(repaired);
        } catch (repairErr) {
          console.warn(`Failed to parse chunk ${chunkIndex}, skipping.`, repairErr);
        }
      }
      
      if (Array.isArray(chunkQuestions)) {
        combinedQuestions = [...combinedQuestions, ...chunkQuestions];
      }
    }
    
    onProgress?.("Reassembling questions and embedding images...");
    
    if (extractedImages.length > 0 && combinedQuestions.length > 0) {
      let finalJSONStr = JSON.stringify(combinedQuestions).replace(/(!\[.*?\]\()?ImageIndex_(\d+)(\)?)/g, (match, prefix, idx, suffix) => {
         const img = extractedImages[parseInt(idx, 10)];
         return img ? `![Image](${img})` : match;
      });

      let imgFallbackIndex = 0;
      finalJSONStr = finalJSONStr.replace(/!\[.*?\]\(\)/g, (match) => {
         const img = extractedImages[imgFallbackIndex % extractedImages.length];
         imgFallbackIndex++;
         return img ? `![Image](${img})` : match;
      });

      combinedQuestions = JSON.parse(finalJSONStr);
    }
    
    if (Array.isArray(combinedQuestions) && combinedQuestions.length > 0) {
      await Promise.all(combinedQuestions.map(async (qData: any) => {
          const actualData = qData.data || qData;
          await processSearchImages(actualData);
      }));
      
      const bank = await getBank();
      const newBankItems: BankQuestion[] = combinedQuestions.map((qData: any, idx: number) => {
        const qType = qData.type || 'VSAQ';
        let assignedPaper = qData.paper || defaultPaper || 'AI Generated';
        if (qType === 'OSCE' || defaultPaper === 'OSCE' || (typeof assignedPaper === 'string' && assignedPaper.includes('OSCE'))) {
          assignedPaper = idx < 9 ? 'OSCE Day 1' : 'OSCE Day 2';
        }
        return {
          id: Math.random().toString(36).substring(2, 15),
          type: qType,
          topic: qData.topic || 'combined',
          paper: assignedPaper,
          year: qData.year || defaultYear || 'AI',
          questionLabel: qData.questionLabel || (qType === 'OSCE' ? `Station ${idx + 1}` : undefined),
          data: qData.data || qData,
          used: false
        };
      });
      
      const updatedBank = [...bank, ...newBankItems];
      await saveBank(updatedBank);
      
      return newBankItems;
    } else {
      throw new Error("No valid questions were extracted from this PDF.");
    }
  };

  try {
    return await Promise.race([
      processingPromise(),
      timeoutPromise
    ]);
  } catch (err) {
    console.error("PDF Parsing failed", err);
    throw err;
  }
}

export async function parseTextQuestionBank(textContent: string, fileName: string, defaultYear?: string, defaultPaper?: string, onProgress?: (msg: string) => void): Promise<BankQuestion[]> {
  const timeoutPromise = new Promise<BankQuestion[]>((_, reject) => 
    setTimeout(() => reject(new Error("Global Text processing timeout (10 minutes).")), 600000)
  );

  const processingPromise = async () => {
    onProgress?.("Splitting text document for processing...");
    
    // Split by lines and chunk
    const lines = textContent.split('\n');
    const chunkSize = 150; // process 150 lines at a time
    let combinedQuestions: any[] = [];
    
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunkIndex = Math.floor(i / chunkSize) + 1;
      const totalChunks = Math.ceil(lines.length / chunkSize);
      onProgress?.(`Sending text chunk ${chunkIndex} of ${totalChunks} to AI for extraction...`);
      
      const chunkText = lines.slice(i, i + chunkSize).join('\n');
      
      const parts = [
        `[PARSE_PDF_BANK]\nThis is a portion of a past exam paper or question bank document. Extract all questions from this text, map them to one of the 9 core topics, and format them as the specified JSON array structure.\nSource File: "${fileName}".\nDefault Year: ${defaultYear || 'AI'}. Default Paper: ${defaultPaper || 'Paper'}.\n\nText Content:\n${chunkText}`
      ];
      
      const parsedText = await callAI(parts, {
        systemInstruction: await getSystemPrompt(undefined, true),
        temperature: 0.1,
        responseMimeType: "application/json"
      }, getTaskModel('parsing'));
      
      let chunkQuestions: any[] = [];
      try {
        chunkQuestions = JSON.parse(parsedText || "[]");
      } catch (e) {
        try {
          const repaired = jsonrepair(parsedText || "[]");
          chunkQuestions = JSON.parse(repaired);
        } catch (repairErr) {
          console.warn(`Failed to parse chunk ${chunkIndex}, skipping.`, repairErr);
        }
      }
      
      if (Array.isArray(chunkQuestions)) {
        combinedQuestions = [...combinedQuestions, ...chunkQuestions];
      }
    }
    
    onProgress?.("Embedding images for extracted questions...");
    
    if (Array.isArray(combinedQuestions) && combinedQuestions.length > 0) {
      await Promise.all(combinedQuestions.map(async (qData: any) => {
          const actualData = qData.data || qData;
          await processSearchImages(actualData);
      }));
      
      const bank = await getBank();
      const newBankItems: BankQuestion[] = combinedQuestions.map((qData: any, idx: number) => {
        const qType = qData.type || 'VSAQ';
        let assignedPaper = qData.paper || defaultPaper || 'AI Generated';
        if (qType === 'OSCE' || defaultPaper === 'OSCE' || (typeof assignedPaper === 'string' && assignedPaper.includes('OSCE'))) {
          assignedPaper = idx < 9 ? 'OSCE Day 1' : 'OSCE Day 2';
        }
        return {
          id: Math.random().toString(36).substring(2, 15),
          type: qType,
          topic: qData.topic || 'combined',
          paper: assignedPaper,
          year: qData.year || defaultYear || 'AI',
          questionLabel: qData.questionLabel || (qType === 'OSCE' ? `Station ${idx + 1}` : undefined),
          data: qData.data || qData,
          used: false
        };
      });
      
      const updatedBank = [...bank, ...newBankItems];
      await saveBank(updatedBank);
      
      return newBankItems;
    } else {
      throw new Error("No valid questions were extracted from this document.");
    }
  };

  try {
    return await Promise.race([
      processingPromise(),
      timeoutPromise
    ]);
  } catch (err) {
    console.error("Text parsing failed", err);
    throw err;
  }
}


export async function generateSingleQuestion(type: string, requestedTopic: string) {
  let topic = requestedTopic;
  if (topic === 'combined') {
    const TOPICS = [
      "Cataract", "Cornea and External Eye", "Glaucoma",
      "Neuro-ophthalmology", "Ocular Inflammation", "Ocular Motility",
      "Oculoplastics and Orbit", "Paediatrics", "Vitreoretinal"
    ];
    topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  }

  const bank = await getBank();
  let available = bank.filter(q => q.type === type && q.topic === topic && !q.used);

  if (available.length === 0) {
    const allMatching = bank.filter(q => q.type === type && q.topic === topic);
    if (allMatching.length > 0) {
      // Recycle: reset used flags for this set
      bank.forEach(q => {
        if (q.type === type && q.topic === topic) {
          q.used = false;
        }
      });
      available = allMatching;
    }
  }

  if (available.length > 0) {
    const selected = available[Math.floor(Math.random() * available.length)];
    // Mark as used
    bank.forEach(q => { if (q.id === selected.id) q.used = true; });
    await saveBank(bank);
    return selected.data;
  }

  try {
    const count = 3; // Generate 3 questions at once to seed the bank
    const parsedText = await callAI([
      `[GENERATE_QUESTION_BATCH]
Ensure all generated questions are unique and varied!
Exam Type: ${type}
Topic: ${topic}
Count: ${count}`
    ], {
      systemInstruction: await getSystemPrompt(topic),
      temperature: 0.85,
      responseMimeType: "application/json"
    }, getTaskModel('generation'));
    
    let questionsArr: any[] = [];
    try {
      questionsArr = JSON.parse(parsedText || "[]");
    } catch (e) {
      console.warn("JSON parse failed, attempting jsonrepair...", e);
      try {
        const repaired = jsonrepair(parsedText || "[]");
        questionsArr = JSON.parse(repaired);
      } catch (repairErr) {
        throw new Error("Failed to parse AI output. The response might have been truncated.");
      }
    }
    
    if (Array.isArray(questionsArr) && questionsArr.length > 0) {
      const newBankItems: BankQuestion[] = questionsArr.map((qData: any) => ({
        id: Math.random().toString(36).substring(2, 15),
        type,
        topic,
        data: qData,
        used: false
      }));
      
      newBankItems[0].used = true;
      const returnedData = newBankItems[0].data;
      
      const updatedBank = [...bank, ...newBankItems];
      await saveBank(updatedBank);
      
      return returnedData;
    } else {
      throw new Error("Parsed result is not a valid array");
    }
  } catch (err) {
    console.error("Exam generation failed", err);
    throw err;
  }
}

async function fetchCommonsImage(originalQuery: string): Promise<string> {
  const trySearchWiki = async (query: string): Promise<string | null> => {
      try {
          const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&prop=pageimages&piprop=original&format=json&origin=*`;
          const res = await fetch(wikiSearchUrl);
          const data = await res.json();
          if (data.query && data.query.pages) {
              const pages = Object.values(data.query.pages) as any[];
              // Sort by relevance index ascending so most relevant page is checked first
              pages.sort((a, b) => (a.index || 0) - (b.index || 0));
              // Filter out known bad placeholders or icons
              const pageWithImage = pages.find(p => {
                  if (!p.original || !p.original.source) return false;
                  const src = p.original.source.toLowerCase();
                  if (src.includes('icon') || src.includes('logo') || src.includes('symbol') || src.includes('stub')) return false;
                  return true;
              });
              if (pageWithImage) {
                  return pageWithImage.original.source;
              }
          }
      } catch (e) { /* ignore */ }
      return null;
  };

  const trySearchCommons = async (query: string): Promise<string | null> => {
      try {
        const searchUrl = 'https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(query + ' filetype:bitmap -icon -logo -symbol -stub') + '&utf8=&format=json&srnamespace=6&origin=*';
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        
        if (searchData.query && searchData.query.search && searchData.query.search.length > 0) {
           const title = searchData.query.search[0].title;
           const imageReqUrl = 'https://commons.wikimedia.org/w/api.php?action=query&titles=' + encodeURIComponent(title) + '&prop=imageinfo&iiprop=url&format=json&origin=*';
           const imageRes = await fetch(imageReqUrl);
           const imageData = await imageRes.json();
           const pages = imageData.query.pages;
           const pageId = Object.keys(pages)[0];
           if (pageId && pageId !== '-1' && pages[pageId].imageinfo && pages[pageId].imageinfo.length > 0) {
               return pages[pageId].imageinfo[0].url;
           }
        }
      } catch(e) { /* ignore */ }
      return null;
  };

  let img = await trySearchWiki(originalQuery);
  if (!img) img = await trySearchCommons(originalQuery);
  if (!img) {
      const words = originalQuery.split(' ');
      if (words.length > 2) {
          img = await trySearchWiki(words.slice(0, 2).join(' '));
          if (!img) img = await trySearchCommons(words.slice(0, 2).join(' '));
      }
  }
  if (!img) {
      const words = originalQuery.split(' ');
      if (words.length > 1) {
          img = await trySearchWiki(words[0]);
          if (!img) img = await trySearchCommons(words[0]);
      }
  }
  if (img) return img;

  const safeQuery = encodeURIComponent(originalQuery.replace(/\s+/g, '+').substring(0, 30));
  return 'https://placehold.co/800x400/e2e8f0/1e293b.png?text=Clinical+Photograph:+' + safeQuery;
}

export async function generateFreshQuestions(type: string, topic: string, customLabel: string, paperName: string, count: number = 1) {
  try {
  const parsedText = await callAI([
      `[GENERATE_QUESTION_BATCH]\nExam Type: ${type}\nTopic: ${topic}\nCount: ${count}`
    ], {
      systemInstruction: await getSystemPrompt(topic),
      temperature: 0.85,
      responseMimeType: "application/json"
    }, getTaskModel('generation'));
    
    let questionsArr: any[] = [];
    try {
      questionsArr = JSON.parse(parsedText || "[]");
    } catch (e) {
      try {
        const repaired = jsonrepair(parsedText || "[]");
        questionsArr = JSON.parse(repaired);
      } catch (repairErr) {
        throw new Error("Failed to parse AI output. The response might have been truncated.");
      }
    }
    
    if (Array.isArray(questionsArr) && questionsArr.length > 0) {
      // Auto-fetch images where requested
      await Promise.all(questionsArr.map(async (qData: any) => {
          await processSearchImages(qData);
      }));
      const bank = await getBank();
      const newBankItems: BankQuestion[] = [];
      
      for (const qData of questionsArr) {
          const subQs = qData.subQuestions;
          if (!subQs || !Array.isArray(subQs) || subQs.length === 0) {
            throw new Error(`Validation failed: Generated question is missing subQuestions structure.`);
          }

          let extractedYear: string | undefined = undefined;
          if (paperName && paperName.match(/\d{4}/)) {
              extractedYear = paperName.match(/\d{4}/)?.[0];
          }
          extractedYear = extractedYear || "AI";

          newBankItems.push({
            id: Math.random().toString(36).substring(2, 15),
            type,
            topic,
            questionLabel: customLabel,
            paper: paperName,
            year: extractedYear,
            data: qData,
            used: false
          });
      }
      
      const updatedBank = [...bank, ...newBankItems];
      await saveBank(updatedBank);
      
      return newBankItems;
    } else {
      throw new Error("Parsed result is not a valid array");
    }
  } catch (err) {
    console.error("Exam generation failed", err);
    throw err;
  }
}

export interface QuestionSpec {
  specId: string;
  type: string;
  topic: string;
  label: string;
  paperName: string;
}

export async function generateCustomBatch(specs: QuestionSpec[], onProgress?: (msg: string) => void) {
  const uniqueTopics = Array.from(new Set(specs.map(s => s.topic)));
  try {
  const parsedText = await callAI([
      `[GENERATE_CUSTOM_BATCH]\n${JSON.stringify(specs, null, 2)}`
    ], {
      systemInstruction: await getSystemPrompt(uniqueTopics),
      temperature: 0.7,
      responseMimeType: "application/json"
    }, getTaskModel('generation'));
    
    let questionsArr: any[] = [];
    try {
      questionsArr = JSON.parse(parsedText || "[]");
    } catch (e) {
      try {
        const repaired = jsonrepair(parsedText || "[]");
        questionsArr = JSON.parse(repaired);
      } catch (repairErr) {
        throw new Error("Failed to parse AI output. The response might have been truncated.");
      }
    }
    
    if (Array.isArray(questionsArr) && questionsArr.length > 0) {
      // Auto-fetch images where requested
      await Promise.all(questionsArr.map(async (qWrapper: any) => {
          if (qWrapper.data) await processSearchImages(qWrapper.data);
      }));
      const bank = await getBank();
      const newBankItems: BankQuestion[] = [];
      
      for (let i = 0; i < questionsArr.length; i++) {
        const qWrapper = questionsArr[i];
        let spec = specs.find(s => s.specId === qWrapper.specId);
        
        // Fallback: If AI forgot specId or gave wrong specId, try matching by array index
        if (!spec && specs.length === questionsArr.length) {
          spec = specs[i];
        }

        if (spec && qWrapper.data) {
          const subQs = qWrapper.data.subQuestions;
          if (!subQs || !Array.isArray(subQs) || subQs.length === 0) {
            throw new Error(`Validation failed: Generated question ${spec.label} is missing subQuestions structure.`);
          }

          let extractedYear: string | undefined = undefined;
          if (spec.paperName && spec.paperName.match(/\d{4}/)) {
              extractedYear = spec.paperName.match(/\d{4}/)?.[0];
          }
          extractedYear = extractedYear || "AI";

          newBankItems.push({
            id: Math.random().toString(36).substring(2, 15),
            specId: spec.specId,
            type: spec.type,
            topic: spec.topic,
            questionLabel: spec.label,
            paper: spec.paperName || 'AI Generated',
            year: extractedYear,
            data: qWrapper.data,
            used: false
          });
        }
      }
      
      // We no longer throw an error if length === 0. Returning [] is perfectly valid,
      // AdminDashboard will see the generatedSpecIds is empty, increment the attempts
      // for the remaining specs, and try again in the next chunk rotation.
      
      const updatedBank = [...bank, ...newBankItems];
      await saveBank(updatedBank);
      
      return newBankItems;
    } else {
      throw new Error("Parsed result is not a valid array");
    }
  } catch (err: any) {
    const errorStr = (err && err.message) ? err.message : String(err);
    if (errorStr.includes('429 Quota Exceeded') || (err && err.status === 429)) {
      console.warn('API Rate Limit (429) encountered. UI will attempt to retry or notify user.');
    } else {
      console.error('Exam custom batch generation failed', err);
    }
    throw err;
  }
}

export async function gradeAnswerMode(answer: string, pdfBase64: string | null, timeTaken: string, targetTime: string, questionContext: string) {
  try {
    const parts: any[] = [];
    if (pdfBase64) {
      const rawPdfData = pdfBase64.indexOf('base64,') > -1 ? pdfBase64.split('base64,').pop() : pdfBase64;
      if (rawPdfData && rawPdfData.trim().length > 0) {
        parts.push({
          inlineData: {
            mimeType: "application/pdf",
            data: rawPdfData
          }
        });
      }
    }
    parts.push(`[GRADE_ANSWER]\nQuestion Context: ${questionContext}\nUser's Text Answer: ${answer}\nTime Taken: ${timeTaken}\nTarget Time: ${targetTime}`);

    const responseText = await callAI(parts, {
      systemInstruction: "You are the 'RANZCO Assessor', an AI that grades fellowship-level ophthalmic written answers. Compare the candidate's text answer against the provided question context and standard model answer. Score the response using a points-based system based on the Angoff Pass Mark standard. Output details in the requested raw JSON format.",
      temperature: 0.2,
      responseMimeType: "application/json"
    }, getTaskModel('grading'));
    return responseText;
  } catch (err) {
    console.error("Answer grading failed", err);
    throw err;
  }
}

export async function optimizeModelAnswer(questionText: string, currentAnswer: string, optimizationPrompt: string): Promise<string> {
  try {
    const parts = [
      `[OPTIMIZE_MODEL_ANSWER]\nQuestion: ${questionText}\nCurrent Model Answer: ${currentAnswer}\nOptimization Request: ${optimizationPrompt}`
    ];
    let responseText = await callAI(parts, {
      systemInstruction: await getSystemPrompt(undefined, true),
      temperature: 0.4,
    }, getTaskModel('optimization'));
    // Strip markdown blocks if the AI somehow included them
    responseText = responseText.replace(/^```[a-z]*\n/m, "").replace(/```$/m, "").trim();
    return responseText;
  } catch(err) {
    console.error("Optimization failed", err);
    throw err;
  }
}

export async function updateQuestion(updatedQuestion: BankQuestion) {
  const bank = await getBank();
  const idx = bank.findIndex(q => q.id === updatedQuestion.id);
  if (idx !== -1) {
    bank[idx] = updatedQuestion;
    await saveBank(bank);
  }
}
