import { GoogleGenAI } from '@google/genai';
import { jsonrepair } from 'jsonrepair';
import { get, set } from 'idb-keyval';

let aiInstance: GoogleGenAI | null = null;
let currentKey = '';

export function getAiConfig() {
  const customKey = localStorage.getItem('ranzco_api_key');
  const apiKey = customKey || process.env.GEMINI_API_KEY || '';
  const modelName = localStorage.getItem('ranzco_ai_model') || 'gemini-2.5-pro';
  const provider = localStorage.getItem('ranzco_ai_provider') || 'google';
  return { apiKey, modelName, provider };
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

async function callAI(parts: any[], config: any) {
  const { provider, apiKey, modelName } = getAiConfig();
  
  // Format parts properly for the @google/genai SDK
  const formattedParts = parts.map(p => {
    if (typeof p === 'string') return { text: p };
    return p;
  });

  if (provider === 'google') {
    const ai = getAiClient();
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: formattedParts,
        config: config
      });
      return response.text;
    } catch (e: any) {
      const errorStr = typeof e === 'string' ? e : JSON.stringify(e, Object.getOwnPropertyNames(e));
      if (errorStr.includes('429') || errorStr.toLowerCase().includes('quota') || errorStr.toLowerCase().includes('resource_exhausted')) {
        throw new Error(`[429 Quota Exceeded] ${errorStr}`);
      }
      throw new Error(`API Error: ${errorStr}`);
    }
  }
  
  if (!apiKey) {
    throw new Error(`API Key required for provider: ${provider}`);
  }

  // Handle OpenAI / DeepSeek format
  if (provider === 'openai' || provider === 'deepseek') {
    const baseUrl = provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    
    // Transform parts to OpenAI format
    let userMessageContent: any[] | string = [];
    if (typeof parts === 'string') {
      userMessageContent = parts;
    } else if (Array.isArray(parts)) {
      userMessageContent = parts.map(p => {
        if (typeof p === 'string') return { type: 'text', text: p };
        if (p?.inlineData?.mimeType === 'application/pdf') {
          // OpenAI currently won't support PDF easily without files API, but for compatibility let's just send as text or warn
          throw new Error("PDF processing currently only fully supported with Google / Anthropic. Use JSON upload for OpenAI/Deepseek.");
        }
        if (p?.inlineData?.mimeType?.startsWith('image/')) {
           return { type: 'image_url', image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } };
        }
        return { type: 'text', text: JSON.stringify(p) };
      });
      // If it's a single string element, just send the string
      if (userMessageContent.length === 1 && userMessageContent[0].type === 'text') {
         userMessageContent = userMessageContent[0].text;
      }
    }

    const isO1Mode = modelName.startsWith('o1') || modelName.startsWith('o3');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    const messages = [];
    if (config.systemInstruction) {
      // O-series models use 'developer' or just integrate into user prompt
      messages.push({ role: isO1Mode ? 'developer' : 'system', content: config.systemInstruction });
    }
    messages.push({ role: 'user', content: userMessageContent });

    const body: any = {
      model: modelName,
      messages
    };

    if (config.responseMimeType === 'application/json' && !isO1Mode) {
      body.response_format = { type: 'json_object' };
    }
    
    // O-series don't support temperature well often, but let's pass if not o1
    if (config.temperature !== undefined && !isO1Mode) {
      body.temperature = config.temperature;
    }

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      let errTxt = '';
      try { errTxt = await res.text(); } catch(e) {}
      throw new Error(`API Error ${res.status}: ${errTxt}`);
    }
    
    const data = await res.json();
    return cleanJsonText(data.choices?.[0]?.message?.content || "");
  }
  
  if (provider === 'anthropic') {
    // Anthropic API might have CORS issues from browser, but using standard fetch we'll try
    // We add anthropic-dangerously-allow-browser or just use standard headers (requires proxy if blocked)
    // Fortunately Anthropic CORS might work if we just fetch
    let userMessageContent: any[] = [];
    
    (Array.isArray(parts) ? parts : [parts]).forEach(p => {
       if (typeof p === 'string') {
          userMessageContent.push({ type: 'text', text: p });
       } else if (p?.inlineData?.mimeType === 'application/pdf') {
          userMessageContent.push({ 
            type: 'document', 
            source: { type: 'base64', media_type: 'application/pdf', data: p.inlineData.data }
          });
       } else if (p?.inlineData?.mimeType?.startsWith('image/')) {
          userMessageContent.push({ 
            type: 'image', 
            source: { type: 'base64', media_type: p.inlineData.mimeType, data: p.inlineData.data }
          });
       }
    });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerously-allow-browser': 'true' // Supported by their edge workers if we send headers
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 4096,
        system: config.systemInstruction,
        messages: [{ role: 'user', content: userMessageContent }],
        temperature: config.temperature
      })
    });

    if (!res.ok) {
      let errTxt = '';
      try { errTxt = await res.text(); } catch(e) {}
      throw new Error(`Anthropic Error ${res.status}: ${errTxt}`);
    }

    const data = await res.json();
    const responseText = data.content?.map((c: any) => c.text).join('\n') || "";
    return cleanJsonText(responseText);
  }
  
  throw new Error("Unknown AI Provider");
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

import { topicCurriculums } from '../data/curriculums';

async function getSystemPrompt(topic?: string) {
  const globalCurriculum = await getCurriculum();
  const examGuidelines = await getExamGuidelines();
  
  let curriculumText = `Curriculum (The 9 Core Topics):\n1. Cataract\n2. Cornea and External Eye\n3. Glaucoma\n4. Neuro-ophthalmology\n5. Ocular Inflammation\n6. Ocular Motility\n7. Oculoplastics and Orbit\n8. Paediatrics\n9. Vitreoretinal`;
  
  if (topic && topicCurriculums[topic]) {
    curriculumText = `Curriculum Framework / Context for ${topic}:\n${topicCurriculums[topic]}`;
  } else if (topic === 'combined' || topic === 'All') {
    const allTopics = Object.entries(topicCurriculums).map(([k, v]) => `Topic: ${k}\n${v}`).join('\n\n');
    curriculumText = `Combined Curriculum Framework / Context:\n${allTopics}`;
  } else if (globalCurriculum && globalCurriculum.trim().length > 0) {
    curriculumText = `Curriculum Framework / Context:\n${globalCurriculum}`;
  }

  return `You are the "RANZCO RACE Exam Engine & Assessor," an advanced backend AI designed to generate, deliver, and grade Ophthalmology fellowship examinations. You interact with a Moodle-like front-end web application.

STRICT INSTRUCTIONS FOR QUESTION GENERATION:
You must strictly base all generated questions and grading on the provided curriculum boundaries below. Do not generate questions requiring knowledge outside of this specific curriculum.

${curriculumText}

RACE EXAM GUIDELINES & FORMAT:
The following are the exact logistical details, timings, scoring system, and instructions for the exam format that you must abide by when grading or generating questions:
${examGuidelines}

Operational Modes:
You will receive commands from the web app in bracketed formats. You must respond strictly according to the mode triggered.

MODE 1: [GENERATE_QUESTION_BATCH]
Input Parameters: Exam Type (VSAQ/SEQ/OSCE), Topic, Count.
Action: Generate exactly the requested number (Count) of unique questions matching the given type and topic, staying strictly within the provided Curriculum framework boundaries.
CRITICAL RULES:
- IMPORTANT: DO NOT omit any details for brevity. The scenarios MUST be rich, detailed, full-length simulations of actual RACGP/RANZCO fellowship standard exam questions. Include comprehensive patient history, clinical findings, investigations, and context.
- The standard MUST strictly follow and match the complexity, depth, and length of actual past written exam questions. Do NOT generate overly simple, student-level questions. Provide extensive clinical context and data references.
- Images MUST be included if relevant to the question.
- YOU MUST NEVER PROVIDE DIRECT URLs FOR IMAGES.
- ALWAYS use the format: "![Image](SEARCH_IMAGE:your+search+query+here)"
- MUST USE SIMPLE, SHORT KEYWORDS for SEARCH_IMAGE: The query MUST be 1 or 2 words ONLY, naming the core disease or anatomical finding (e.g., "cataract", "glaucoma", "papilledema", "retina", "hyphema"). Do not use highly specific clinical descriptions. Broad terms guarantee a real medical image will be found.
- Break down the question into discrete sub-questions with specific marks allocated for each, mimicking the strict marking structure of the actual past papers (e.g., "a) What is the most likely diagnosis? (2 marks)").
- Ensure the question extent and difficulty matches the provided curriculum framework and realistically reflects the high difficulty level of final fellowship written exams.
- For model answers: The level of detail and knowledge must be at that of a competent Australian comprehensive ophthalmologist. Structure of the answer is important. All model answers should be derived from a reputable source from the internet.

Output Format: STRICTLY raw JSON (no markdown formatting, no \`\`\`json block) with the following exact structure (Array of Question Objects):
[
  {
    "scenario": "**Clinical Scenario:**\\n<scenario text>\\n\\n![Image](<real_open_source_image_url_or_empty_string>)",
    "subQuestions": [
      { "id": "q1", "text": "What is the most likely diagnosis?", "modelAnswer": "The accurate model answer..." },
      { "id": "q2", "text": "List 3 key differential diagnoses.", "modelAnswer": "The accurate model answer..." }
    ]
  }
]

MODE 2: [GRADE_ANSWER]
Input Parameters: User's Answers (JSON), Time Taken, Target Time, Question Context.
Action: Grade the answer using a points-based system and the Angoff Standard. Evaluate strictly based on the provided curriculum framework.
Output Format EXACTLY as follows:
1. Time Critique (compare time taken to target, warn if pacing is off).
2. Angoff Standard & Points Grade:
   - Total Points Available: [X points]
   - Angoff Cut-Score (Pass Mark): [Y points].
   - Candidate Score: [Z points]. 
   - Final Result: Pass / Fail.
3. Detailed Feedback: What was done well, Critical Omissions, Structure & Presentation.

MODE 3: [PARSE_PDF_BANK]
Input Parameters: PDF containing exam questions along with optional examiner feedback. (Also may provide Default Year and Default Paper strings).
Action: Extract all questions from the PDF and format them into the required JSON array structure. Guess the type (VSAQ/SEQ/OSCE), topic (Cataract, Cornea..., etc), paper, and year if they are not explicitly mentioned but can be inferred. YOU MUST POPULATE THE 'year' FIELD. If provided in the prompt, use the Default Year/Paper. Extract or infer the question label (e.g., '2023 Sem 1 Q12' or 'Question 1').
CRITICAL FOR MODEL ANSWERS: Include a 'modelAnswer' for each sub-question. If the PDF contains examiner reports or feedback, use that feedback to construct the absolute best, most accurate 'modelAnswer'. Extrapolate the model answer strictly from what the examiner deemed acceptable or required. If no feedback is present, generate a model answer based on the curriculum. The level of detail and knowledge must be at that of a competent Australian comprehensive ophthalmologist. Structure of the answer is important. All model answers should be provided from a reputable source from the internet.
Output Format: STRICTLY raw JSON array:
[
  {
    "type": "VSAQ",
    "topic": "Glaucoma",
    "paper": "Paper 1",
    "year": "2023",
    "questionLabel": "2023 Sem 1 Q12",
    "data": {
      "scenario": "**Clinical Scenario:**\\n<text>",
      "subQuestions": [
        { "id": "q1", "text": "Question text", "modelAnswer": "Inferred or explicit model answer" }
      ]
    }
  }
]

MODE 5: [GENERATE_CUSTOM_BATCH]
Input Parameters: A JSON list of question specifications. Each specification has an 'specId', 'type', 'topic', 'label', and 'paperName'.
Action: Generate exactly one unique question for EACH specification in the input list, strictly matching its requested type and topic. Stay within the Curriculum framework boundaries.
CRITICAL RULES:
- IMPORTANT: DO NOT omit any details for brevity. The scenarios MUST be rich, detailed, full-length simulations of actual RACGP/RANZCO fellowship standard exam questions. Include comprehensive patient history, clinical findings, investigations, and context.
- The standard MUST strictly follow and match the complexity, depth, and length of actual past written exam questions. Do NOT generate overly simple, student-level questions. Provide extensive clinical context and data references.
- Images MUST be included if relevant to the question.
- YOU MUST NEVER PROVIDE DIRECT URLs FOR IMAGES.
- ALWAYS use the format: "![Image](SEARCH_IMAGE:your+search+query+here)"
- MUST USE SIMPLE, SHORT KEYWORDS for SEARCH_IMAGE: The query MUST be 1 or 2 words ONLY, naming the core disease or anatomical finding (e.g., "cataract", "glaucoma", "papilledema", "retina", "hyphema"). Do not use highly specific clinical descriptions. Broad terms guarantee a real medical image will be found.
- Break down the question into discrete sub-questions with specific marks allocated for each, mimicking the strict marking structure of the actual past papers (e.g., "a) What is the most likely diagnosis? (2 marks)").
- Ensure the question extent and difficulty matches the provided curriculum framework and realistically reflects the high difficulty level of final fellowship written exams.
- For model answers: The level of detail and knowledge must be at that of a competent Australian comprehensive ophthalmologist. Structure of the answer is important. All model answers should be derived from a reputable source from the internet.

Output Format: STRICTLY raw JSON array (no markdown formatting, no \`\`\`json block) where each object has:
[
  {
    "specId": "id from input spec",
    "data": {
      "scenario": "**Clinical Scenario:**\\n<scenario text>\\n\\n![Image](<real_open_source_image_url_or_empty_string>)",
      "subQuestions": [
        { "id": "q1", "text": "What is the most likely diagnosis?", "modelAnswer": "The accurate model answer..." }
      ]
    }
  }
]

MODE 4: [OPTIMIZE_MODEL_ANSWER]
Input Parameters: Question text, Current Model Answer, Optimization Request.
Action: Evaluate the current model answer. Enhance, rewrite, or expand it exactly as instructed by the administrator's request (e.g. "make it more concise", "add more detail based on current college guidelines"). 
Output Format: The raw text of the improved answer ONLY. Do not include markdown blocks, json, or conversational filler.`;
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
  
  if (needsResave && !isSupabaseConfigured) {
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
    onProgress?.("Extracting clinical images from PDF (this may take up to 3 minutes)...");
    const extractedImages = await extractImagesFromPDF(pdfBase64);
    
    const rawPdfData = pdfBase64.indexOf('base64,') > -1 ? pdfBase64.split('base64,').pop() : pdfBase64;
    
    if (!rawPdfData || rawPdfData.trim().length === 0) {
      throw new Error("Invalid or empty PDF data provided.");
    }
    
    onProgress?.(`Sending PDF + ${extractedImages.length} images to AI for extraction (this may take 1-5 minutes)...`);
    const parts: any[] = [
      {
        inlineData: {
          mimeType: "application/pdf",
          data: rawPdfData
        }
      },
      `[PARSE_PDF_BANK]\nPlease read this document, extract all questions, identify their type and topic among the 9 core topics, and format them as the specified JSON array structure. The original file name is "${fileName}" which may contain the year, semester, or paper information. Override year or paper with info from the filename if found. Use the filename as the source of truth for the exam date/paper if it looks like e.g., "2021 Sem 1" or "RANZCO 2021". ${defaultYear ? `Default Year Fallback: ${defaultYear}. ` : ''}${defaultPaper ? `Default Paper Fallback: ${defaultPaper}. ` : ''}`
    ];

    if (extractedImages.length > 0) {
      parts.push(`\n\n--- EXTRACTED IMAGES FROM PDF (${extractedImages.length} images) ---`);
      extractedImages.forEach((imgB64, idx) => {
          const rawData = imgB64.indexOf('base64,') > -1 ? imgB64.split('base64,').pop() : imgB64;
          if (rawData && rawData.trim().length > 0) {
            parts.push(`\nImageIndex_${idx}:`);
            parts.push({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: rawData
                }
            });
          }
      });
      parts.push(`\nCRITICAL: If a question has an associated clinical image in the original PDF, you MUST insert its exact markdown tag (e.g. ![Image](ImageIndex_0)) inside the 'scenario' field. Replace 0 with the actual index number matching the image. Do this for EVERY image you can confidently associate with a question. \nWARNING: Do NOT output an empty tag like ![Image](). You MUST include the ImageIndex_X inside the parentheses. Failure to include the image tag will ruin the exam for the student.`);
    }

    const parsedText = await callAI(parts, {
      systemInstruction: await getSystemPrompt(),
      temperature: 0.2, // Low temp for extraction tasks
      responseMimeType: "application/json"
    });
    onProgress?.("AI extraction complete. Validating and saving to database...");
    console.log(`[PARSE_PDF_BANK] extractedImages count: ${extractedImages.length}`);
    console.log(`[PARSE_PDF_BANK] AI parsedText snippet:`, parsedText.substring(0, 500) + '...');

    let questionsArr: any[] = [];
    try {
      questionsArr = JSON.parse(parsedText || "[]");
    } catch (e) {
      console.warn("JSON parse failed, attempting jsonrepair...", e);
      try {
        const repaired = jsonrepair(parsedText || "[]");
        questionsArr = JSON.parse(repaired);
      } catch (repairErr) {
        throw new Error("Failed to parse AI output. The PDF might be too large and the response got truncated. Try uploading a smaller portion (fewer pages).");
      }
    }

    // Replace ImageIndex with actual base64
    if (extractedImages.length > 0) {
      let finalJSONStr = JSON.stringify(questionsArr).replace(/(!\[.*?\]\()?ImageIndex_(\d+)(\)?)/g, (match, prefix, idx, suffix) => {
         const img = extractedImages[parseInt(idx, 10)];
         // Ensure it turns into ![Image](data:image/...)
         return img ? `![Image](${img})` : match;
      });

      // Fallback for empty ![Image]() tags
      let imgFallbackIndex = 0;
      finalJSONStr = finalJSONStr.replace(/!\[.*?\]\(\)/g, (match) => {
         const img = extractedImages[imgFallbackIndex % extractedImages.length];
         imgFallbackIndex++;
         return img ? `![Image](${img})` : match;
      });

      questionsArr = JSON.parse(finalJSONStr);
    }
    
    if (Array.isArray(questionsArr) && questionsArr.length > 0) {
      // Auto-fetch images where SEARCH_IMAGE is found (useful for external LLM generation imports)
      await Promise.all(questionsArr.map(async (qData: any) => {
          const actualData = qData.data || qData;
          await processSearchImages(actualData);
      }));
      const bank = await getBank();
      let countAdded = 0;
      const newBankItems: BankQuestion[] = questionsArr.map((qData: any) => {
        countAdded++;
        return {
          id: Math.random().toString(36).substring(2, 15),
          type: qData.type || 'VSAQ',
          topic: qData.topic || 'combined',
          paper: qData.paper,
          year: qData.year,
          questionLabel: qData.questionLabel,
          data: qData.data || qData,
          used: false
        };
      });
      
      const updatedBank = [...bank, ...newBankItems];
      await saveBank(updatedBank);
      
      return newBankItems;
    } else {
      throw new Error("Parsed result is not a valid array");
    }
  };

  try {
    return await Promise.race([processingPromise(), timeoutPromise]);
  } catch (err) {
    console.error("PDF Parsing failed", err);
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
    });
    
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
    });
    
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
  try {
    const parsedText = await callAI([
      `[GENERATE_CUSTOM_BATCH]\n${JSON.stringify(specs, null, 2)}`
    ], {
      systemInstruction: await getSystemPrompt('combined'),
      temperature: 0.7,
      responseMimeType: "application/json"
    });
    
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
            paper: spec.paperName,
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
      systemInstruction: await getSystemPrompt(),
      temperature: 0.2,
    });
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
      systemInstruction: await getSystemPrompt(),
      temperature: 0.4,
    });
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
