const fs = require('fs');
const path = require('path');
const { getGenAI } = require('../config/gemini');

const promptPath = path.join(__dirname, '../prompts/classifier.txt');

/**
 * Classifies an uploaded document using Gemini multimodal analysis.
 * Determines the document type, confidence, and target pipeline.
 * 
 * @param {string} filePath - Absolute path to the file on disk.
 * @param {string} originalName - The original name of the file.
 * @returns {Promise<{isMedicalDocument: boolean, documentType: string, confidence: number, pipeline: string}>}
 */
async function classifyDocument(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  let mimeType = 'application/octet-stream';
  
  if (ext === '.pdf') {
    mimeType = 'application/pdf';
  } else if (ext === '.png') {
    mimeType = 'image/png';
  } else if (ext === '.jpg' || ext === '.jpeg') {
    mimeType = 'image/jpeg';
  } else if (ext === '.webp') {
    mimeType = 'image/webp';
  }

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

    console.log(`[ClassifierAgent] Sending file ${originalName} (${mimeType}) to Gemini Classification...`);
    const result = await model.generateContent([prompt, filePart]);
    const responseText = result.response.text();
    console.log(`[ClassifierAgent] Raw response: ${responseText.trim()}`);
    
    const parsed = JSON.parse(responseText);
    
    return {
      isMedicalDocument: parsed.isMedicalDocument !== false,
      documentType: parsed.documentType || (parsed.isMedicalDocument === false ? 'Unrelated Document' : 'Blood Report'),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      pipeline: parsed.pipeline || 'vision_ocr'
    };

  } catch (err) {
    console.warn(`[ClassifierAgent] Classification error: ${err.message}. Falling back to default routing.`);
    if (ext === '.pdf') {
      return { isMedicalDocument: true, documentType: 'Blood Report', confidence: 0.8, pipeline: 'text_pdf' };
    } else if (ext === '.txt') {
      try {
        const text = fs.readFileSync(filePath, 'utf-8');
        const medicalKeywords = ['hemoglobin', 'rbc', 'wbc', 'platelets', 'platelet', 'cholesterol', 'glucose', 'hba1c', 'vitamin', 'tsh', 'thyroid', 'cbc', 'lipid', 'metabolic', 'serum', 'urine', 'creatinine', 'urea', 'bilirubin', 'calcium', 'sodium', 'potassium', 'chloride', 'systolic', 'diastolic'];
        const hasKeywords = medicalKeywords.some(kw => text.toLowerCase().includes(kw));
        return {
          isMedicalDocument: hasKeywords,
          documentType: hasKeywords ? 'Medical Notes' : 'Unrelated Document',
          confidence: 0.8,
          pipeline: 'text_pdf'
        };
      } catch (e) {
        return { isMedicalDocument: false, documentType: 'Unrelated Document', confidence: 0.8, pipeline: 'text_pdf' };
      }
    } else {
      return { isMedicalDocument: true, documentType: 'Blood Report', confidence: 0.8, pipeline: 'vision_ocr' };
    }
  }
}

module.exports = { classifyDocument };
