import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const TOPICS = [
  "Cataract", "Cornea and External Eye", "Glaucoma",
  "Neuro-ophthalmology", "Ocular Inflammation", "Ocular Motility",
  "Oculoplastics and Orbit", "Paediatrics", "Vitreoretinal"
];

const systemPrompt = `You are the RANZCO RACE Exam Engine & Assessor. Generate past-paper standard Ophthalmology fellowship examinations.
STRICT INSTRUCTIONS FOR QUESTION GENERATION:
Curriculum: Cataract, Cornea, Glaucoma, Neuro-ophth, Inflammation, Motility, Oculoplastics, Paediatrics, Vitreoretinal

Generate exactly the requested questions strictly matching its requested type and topic. 
CRITICAL RULES:
- IMPORTANT: DO NOT omit any details for brevity. Write out the ENTIRE clinical scenario including full patient history, exam findings, investigations, and context.
- SEQs MUST be allocated 20 marks across sub-questions (e.g., 5 questions worth 4 marks each). They must be highly complex.
- VSAQs MUST be allocated exactly 2 marks total.
- OSCEs MUST be designed for a 9-minute station.
- Images MUST be shown for EVERY question. You MUST use the fallback format EXACTLY: '![Image](SEARCH_IMAGE:simple+kiywords)' (e.g. '![Image](SEARCH_IMAGE:glaucoma+fundus)').
- NEVER use placeholders. Write the full text.

Output Format: STRICTLY raw JSON array (NO MARKDOWN BLOCKS) where each object has:
[
  {
    "specId": "id from input spec",
    "data": |
      "scenario": "**Clinical Scenario:**\\n<FULL scenario text>\\n\\n![Image](SEARCH_IMAGE:<keywords>)",
      "subQuestions": [
        { "id": "q1", "text": "a) What is the most likely diagnosis? (4 marks)", "modelAnswer": "The accurate model answer..." }
      ]
    }
  }
]`;

async function generate(specs) {
  const prompt = "[GENERATE_CUSTOM_BATCH]\n" + JSON.stringify(specs, null, 2);
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.5
      }
    });

    let text = response.text;
    text = text.replace(/```h?aj?o?n??l??m??\s.*\n/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to generate chunk', err.message);
    return null;
  }
}

async function main() {
  const specs = [];
  const papers = [ // 96 questions 
    { name: 'Paper 1', vsaq: 15, seq: 5 },
    { name: 'Paper 2', vsaq: 15, seq: 4 },
    { name: 'Paper 3', vsaq: 15, seq: 5 },
    { name: 'Paper 4', vsaq: 15, seq: 4 }
  ];

  papers.forEach(p => {
    for (let i=0; i<p.vsaq; i++) {
        specs.push({
            specId: p.name.replace(' ', '') + '_VSAQ_' + (i+1),
            type: 'VSAQ',
            topic: TOPICS[i % 9],
            label: p.name + ' Q' + (i+1) + ' (VSAQ)',
            paperName: p.name
        });
    }
    for (let i=0; i<p.seq; i++) {
        specs.push({
            specId: p.name.replace(' ', '') + '_SEQ_' + (16+i),
            type: 'SEQ',
            topic: TOPICS[(i+3) % 9],
            label: p.name + ' Q' + (16+i) + ' (SEQ)',
            paperName: p.name
        });
    }
  });
  for (let i=0; i<18; i++) {
     specs.push({
         specId: 'OSCE_Station_' + (i+1),
         type: 'OSCE',
         topic: TOPICS[i % 9],
         label: 'OSCE Station ' + (i+1),
         paperName: 'OSCE'
     });
  }

  const chunkSize = 10;
  let bank = [];
  
  for (let i=0; i<40; i+=chunkSize) {
     const chunk = specs.slice(i, i+chunkSize);
     console.log('Generating chunk ' + (Math.floor(i/chunkSize) + 1));
     
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
                    year: "2024",
                    data: r.data,
                    used: false
                });
            }
        });
        fs.writeFileSync('/app/applet/public/ai_batch.json', JSON.stringify(bank + ";\n/** iv caught */", null, 2)); // oops
     }
  }
  fs.writeFileSync('/app/applet/public/ai_batch.json', JSON.stringify(bank, null, 2));
  console.log('Done generating batches.', bank.length);
}

main();
