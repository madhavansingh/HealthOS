const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY not configured in server/.env');
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Extracts structured medical data from handwritten prescriptions and doctor notes.
 * 
 * @param {string} filePath - Absolute path to the image file.
 * @param {string} originalName - Original filename.
 * @returns {Promise<{medications: Array, tests: Array, instructions: Array, symptoms: Array}>}
 */
async function extractPrescription(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  if (ext === '.webp') mimeType = 'image/webp';
  if (ext === '.pdf') mimeType = 'application/pdf'; // Support pdf notes too

  const prompt = `You are a medical handwriting interpretation expert.
Analyze the attached handwritten prescription or doctor's note and extract:
1. Medications (including medicine name, dosage, frequency, and instructions if present)
2. Recommended tests (e.g. "complete blood count", "lipid panel", "thyroid checkup")
3. Symptoms or complaints mentioned (e.g. "fever", "headache", "fatigue")
4. General doctor instructions or advice (e.g. "take after food", "bed rest for 3 days")

CRITICAL INSTRUCTIONS:
- Do NOT invent or assume any information.
- If a word is completely illegible, transcribe it as "[illegible]".
- If you are uncertain about a word, represent it as "[uncertain: likely X]", where X is your best interpretation.
- Provide a confidence score (between 0.0 and 1.0) for each extracted item.

Return a JSON object in exactly this format:
{
  "medications": [
    { "name": "Aspirin", "dosage": "75mg", "frequency": "once daily", "confidence": 0.95 }
  ],
  "tests": [
    { "name": "Vitamin D test", "confidence": 0.92 }
  ],
  "symptoms": [
    { "name": "Fatigue", "confidence": 0.88 }
  ],
  "instructions": [
    { "text": "Take after meals", "confidence": 0.96 }
  ]
}`;

  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    });

    const fileBuffer = fs.readFileSync(filePath);
    const filePart = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType: mimeType
      }
    };

    console.log(`[PrescriptionAgent] Sending handwritten file ${originalName} to Gemini...`);
    const result = await model.generateContent([prompt, filePart]);
    const responseText = result.response.text();
    console.log(`[PrescriptionAgent] Raw response: ${responseText.trim()}`);

    const parsed = JSON.parse(responseText);

    return {
      medications: Array.isArray(parsed.medications) ? parsed.medications : [],
      tests: Array.isArray(parsed.tests) ? parsed.tests : [],
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [],
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : []
    };

  } catch (err) {
    console.error(`[PrescriptionAgent] Extraction error:`, err.message);
    throw err;
  }
}

module.exports = { extractPrescription };
