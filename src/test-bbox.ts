import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  // We'll just write the code here to see if it compiles
}
test();
