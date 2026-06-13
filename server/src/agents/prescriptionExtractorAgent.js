const fs = require('fs');
const path = require('path');
const { getGenAI } = require('../config/gemini');

const promptPath = path.join(__dirname, '../prompts/prescription.txt');

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
  if (ext === '.pdf') mimeType = 'application/pdf';

  try {
    const prompt = fs.readFileSync(promptPath, 'utf-8');
    const ai = getGenAI();
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
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

    console.log(`[PrescriptionExtractorAgent] Sending handwritten file ${originalName} to Gemini...`);
    const result = await model.generateContent([prompt, filePart]);
    const responseText = result.response.text();
    console.log(`[PrescriptionExtractorAgent] Raw response: ${responseText.trim()}`);

    const parsed = JSON.parse(responseText);

    return {
      medications: Array.isArray(parsed.medications) ? parsed.medications : [],
      tests: Array.isArray(parsed.tests) ? parsed.tests : [],
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [],
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : []
    };

  } catch (err) {
    console.error(`[PrescriptionExtractorAgent] Extraction error:`, err.message);
    throw err;
  }
}

module.exports = { extractPrescription };
