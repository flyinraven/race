import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const TOPICS = [
  "Cataract", "Cornea and External Eye", "Glaucoma",
  "Neuro-ophthalmology", "Ocular Inflammation", "Ocular Motility",
  "Oculoplastics and Orbit", "Paediatrics", "Vitreoretinal"
];

const systemPrompt = `You are the "RANZCO RACE Exam Engine & Assessor," an advanced backend AI designed to generate, deliver, and grade Ophthalmology fellowship examinations.
STRICT INSTRUCTIONS FOR QUESTION GENERATION:
You must strictly base all generated questions and grading on the provided curriculum boundaries below. Do not generate questions requiring knowledge outside of this specific curriculum.
Curriculum (The 9 Core Topics):
1. Cataract
2. Cornea and External Eye
3. Glaucoma
4. Neuro-ophthalmology
5. Ocular Inflammation
6. Ocular Motility
7. Oculoplastics and Orbit
8. Paediatrics
9. Vitreoretinal

MODE 5: [GENERATE_CUSTOM_BATCH]
Input Parameters: A JSON list of question specifications. Each specification has an 'specId', 'type', 'topic', 'label', and 'paperName'.
Action: Generate exactly one unique question for EACH specification in the input list, strictly matching its requested type and topic. Stay within the Curriculum framework boundaries.
CRITICAL RULES:
- Images MUST be shown if relevant to the question (e.g., "describe the finding"). OSCEs MUST have images unless completely irrelevant to the question.
- You can provide a REAL, valid, active URL to any reputable open-source image (e.g. Wikimedia Commons, NEJM, EyeWiki, AAO) if it is directly and accurately related to the question.
- AI models often hallucinate broken image links. If you are not 100% confident the URL is active, you MUST instead use the fallback format: "![Image](SEARCH_IMAGE:your+search+query+here)" (e.g., "SEARCH_IMAGE:cataract+eye"). The system will automatically fetch a relevant open-source medical image.
- MUST USE SIMPLE, BROAD KEYWORDS for SEARCH_IMAGE: Do not use highly specific descriptive terms (like "glaucomatous+optic+cupping"). Use simple keywords (e.g. "glaucoma+fundus", "retina", "cornea+ulcer").
- Use SEARCH_IMAGE to request images for ALL clinical scenarios (VSAQ, SEQ, OSCE) that require visual findings but where you lack an exact active URL.
- Break down the question into discrete sub-questions with specific marks allocated for each, mimicking the strict marking structure of the actual past papers (e.g., "a) What is the most likely diagnosis? (2 marks)").
- Ensure the question extent and difficulty matches the provided curriculum framework and realistically reflects the high difficulty level of final fellowship written exams.
- For model answers: The level of detail and knowledge must be at that of a competent Australian comprehensive ophthalmologist. Structure of the answer is important. All model answers should be derived from a reputable source from the internet.

Output Format: STRICTLY raw JSON array (no markdown formatting, no \`\`\`json block) where each object has:
[
  {
    "specId": "id from input spec",
    "data": {
      "scenario": "**Clinical Scenario:**\n<scenario text>\n\n![Image](<real_open_source_image_url_or_empty_string>)",
      "subQuestions": [
        { "id": "q1", "text": "a) What is the most likely diagnosis? (2 marks)", "modelAnswer": "The accurate model answer..." }
      ]
    }
  }
]`;

async function generate(specs) {
  const prompt = `[GENERATE_CUSTOM_BATCH]\n${JSON.stringify(specs, null, 2)}`;
  let result = null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2
      }
    });

    let text = response.text;
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    result = JSON.parse(text);
  } catch (err) {
    console.error("Failed to generate chunk:", err.message);
  }
  return result;
}

async function main() {
  const specs = [];
  
  const papers = [
    { name: 'Paper 1', vsaq: 15, seq: 5 },
    { name: 'Paper 2', vsaq: 15, seq: 4 },
    { name: 'Paper 3', vsaq: 15, seq: 5 },
    { name: 'Paper 4', vsaq: 15, seq: 4 }
  ];

  papers.forEach(p => {
    for (let i=0; i<p.vsaq; i++) {
        specs.push({
            specId: `${p.name.replace(' ', '')}_VSAQ_${i+1}`,
            type: 'VSAQ',
            topic: TOPICS[i % 9],
            label: `${p.name} Q${i+1} (VSAQ)`,
            paperName: p.name
        });
    }
    for (let i=0; i<p.seq; i++) {
        specs.push({
            specId: `${p.name.replace(' ', '')}_SEQ_${16+i}`,
            type: 'SEQ',
            topic: TOPICS[(i+3) % 9],
            label: `${p.name} Q${16+i} (SEQ)`,
            paperName: p.name
        });
    }
  });

  for (let i=0; i<18; i++) {
     specs.push({
         specId: `OSCE_Station_${i+1}`,
         type: 'OSCE',
         topic: TOPICS[i % 9],
         label: `OSCE Station ${i+1}`,
         paperName: 'OSCE'
     });
  }

  // load existing
  let bank = JSON.parse(fs.readFileSync('public/ai_batch.json', 'utf8'));

  // chunk by 4 to speed up
  const chunkSize = 4;
  for (let i=0; i<specs.length; i+=chunkSize) {
     const chunk = specs.slice(i, i+chunkSize);
     console.log(`Generating chunk ${Math.floor(i/chunkSize) + 1} of ${Math.ceil(specs.length/chunkSize)}...`);
     
     let retries = 0;
     let success = false;
     while (!success && retries < 3) {
        const chunkRes = await generate(chunk);
        if (chunkRes && Array.isArray(chunkRes)) {
            chunkRes.forEach(r => {
                const spec = chunk.find(s => s.specId === r.specId);
                if (spec) {
                    bank.push({
                        id: Math.random().toString(36).substring(2, 15),
                        type: spec.type,
                        topic: spec.topic,
                        questionLabel: spec.label,
                        paper: spec.paperName,
                        year: "AI",
                        data: r.data,
                        used: false
                    });
                }
            });
            fs.writeFileSync('public/ai_batch.json', JSON.stringify(bank, null, 2));
            success = true;
        } else {
            retries++;
            console.log(`Retry ${retries} for chunk...`);
        }
    }
    await new Promise(r => setTimeout(r, 4000));
  }
  console.log("Done generating batches.");
}

main();
