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
 * Classifies an uploaded document using Gemini 2.5 Flash multimodal analysis.
 * Determines the document type, confidence, and target pipeline.
 * 
 * @param {string} filePath - Absolute path to the file on disk.
 * @param {string} originalName - The original name of the file (to extract extension / assist context).
 * @returns {Promise<{documentType: string, confidence: number, pipeline: string}>}
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

  const prompt = `You are a document classification agent.
Analyze the provided document (which can be a PDF or image).

First, determine if this document is a valid medical or health-related document. Valid medical documents include blood test reports, pathology results, lab panel reports, prescriptions, clinical notes, doctor notes, medical scans (e.g., MRI, X-ray, ultrasound findings with text), and health questionnaires.
Non-medical documents include resumes/CVs, receipts/invoices/bills, academic assignments/homework, movie/event posters, random/unrelated photographs (e.g., pets, landscapes, food, memes), and any other unrelated text documents.

Classify the document into one of the following categories:
Medical Categories:
1. "text_pdf": A digital, computer-generated PDF containing clean selectable text (e.g., lab report or prescription).
2. "scanned_pdf": A scanned PDF containing images of printed paper medical reports (no extractable text).
3. "medical_image": A photograph, screenshot, or image of a printed pathology report, lab results table, or medical scan.
4. "handwritten_prescription": A handwritten prescription, doctor note, clinical letter, or list of medical instructions.

Non-Medical Categories (Unsupported):
5. "resume": A curriculum vitae or resume.
6. "invoice": An invoice, receipt, bill, or financial statement.
7. "assignment": An academic assignment, essay, homework, or paper.
8. "movie_poster": A movie or event poster.
9. "unrelated_document": Any other non-medical document or image.

Return a JSON object in exactly this format:
{
  "isMedicalDocument": true | false,
  "documentType": "Blood Report" | "Prescription" | "Doctor Note" | "Medical Scan" | "Resume" | "Invoice" | "Assignment" | "Movie Poster" | "Unrelated Document",
  "confidence": 0.0 to 1.0,
  "pipeline": "text_pdf" | "scanned_pdf" | "vision_ocr" | "vision_prescription" | "none"
}

Provide an accurate confidence score (float between 0.0 and 1.0) and choose the appropriate pipeline. For non-medical documents, set "isMedicalDocument" to false and "pipeline" to "none".`;

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

    console.log(`[Router] Sending file ${originalName} (${mimeType}) to Gemini Classification...`);
    const result = await model.generateContent([prompt, filePart]);
    const responseText = result.response.text();
    console.log(`[Router] Raw response: ${responseText.trim()}`);
    
    const parsed = JSON.parse(responseText);
    
    // Normalize response
    return {
      isMedicalDocument: parsed.isMedicalDocument !== false,
      documentType: parsed.documentType || (parsed.isMedicalDocument === false ? 'Unrelated Document' : 'Blood Report'),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      pipeline: parsed.pipeline || 'vision_ocr'
    };

  } catch (err) {
    console.warn(`[Router] Classification error: ${err.message}. Falling back to default routing.`);
    // Fallback logic if Gemini fails (assume it is a medical document to proceed with local rules)
    if (ext === '.pdf') {
      return { isMedicalDocument: true, documentType: 'Blood Report', confidence: 0.8, pipeline: 'text_pdf' };
    } else {
      return { isMedicalDocument: true, documentType: 'Blood Report', confidence: 0.8, pipeline: 'vision_ocr' };
    }
  }
}

module.exports = { classifyDocument };
