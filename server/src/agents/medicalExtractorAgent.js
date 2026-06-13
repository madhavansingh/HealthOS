const fs = require('fs');
const path = require('path');
const { getGenAI } = require('../config/gemini');
const { generateJSON } = require('./geminiClient');

const promptPath = path.join(__dirname, '../prompts/extractor.txt');

/**
 * Medical Extractor Agent
 * Takes raw text and extracts structured biomarkers matching clinical metrics schema
 * 
 * @param {string} reportText - Extracted OCR text from the report
 * @param {string} reportType - Pre-detected report category (e.g. CBC, Lipid Profile)
 * @returns {Promise<Array>}
 */
async function extractMetrics(reportText, reportType = 'unknown') {
  const promptTemplate = fs.readFileSync(promptPath, 'utf-8');
  const prompt = promptTemplate
    .replace('{reportText}', reportText.slice(0, 8000)) // Limit tokens
    .replace('{reportType}', reportType);

  const metrics = await generateJSON(prompt);

  if (!Array.isArray(metrics)) return [];

  return metrics.map(m => ({
    metric_name: String(m.metric_name || '').trim(),
    value: typeof m.value === 'number' ? m.value : parseFloat(m.value) || null,
    value_text: m.value_text || null,
    unit: String(m.unit || '').trim(),
    reference_low: m.reference_low != null ? parseFloat(m.reference_low) : null,
    reference_high: m.reference_high != null ? parseFloat(m.reference_high) : null,
    status: validateStatus(m.status),
    category: validateCategory(m.category),
  })).filter(m => m.metric_name.length > 0);
}

/**
 * Multimodal Extractor Agent
 * Extracts metrics directly from images or scanned PDFs using Gemini Vision
 */
async function extractMetricsMultimodal(filePath, originalName, reportType = 'unknown') {
  const ext = path.extname(originalName).toLowerCase();
  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  if (ext === '.webp') mimeType = 'image/webp';
  if (ext === '.pdf') mimeType = 'application/pdf';

  const promptTemplate = fs.readFileSync(promptPath, 'utf-8');
  const prompt = promptTemplate
    .replace('{reportText}', 'Please read and extract the clinical values directly from the attached document image/PDF file.')
    .replace('{reportType}', reportType) + `\n\nADDITIONAL INSTRUCTIONS:
For each extracted metric, also include:
- confidence: a float value between 0.0 and 1.0 indicating your extraction confidence for that specific value.
- source: return "vision" for all of them.`;

  try {
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

    console.log(`[MedicalExtractorAgent] Processing multimodal file ${originalName}...`);
    const result = await model.generateContent([prompt, filePart]);
    const responseText = result.response.text();

    const metrics = JSON.parse(responseText);

    if (!Array.isArray(metrics)) return [];

    return metrics.map(m => ({
      metric_name: String(m.metric_name || '').trim(),
      value: typeof m.value === 'number' ? m.value : parseFloat(m.value) || null,
      value_text: m.value_text || null,
      unit: String(m.unit || '').trim(),
      reference_low: m.reference_low != null ? parseFloat(m.reference_low) : null,
      reference_high: m.reference_high != null ? parseFloat(m.reference_high) : null,
      status: validateStatus(m.status),
      category: validateCategory(m.category),
      confidence: typeof m.confidence === 'number' ? m.confidence : 0.93,
      source: m.source || 'vision',
    })).filter(m => m.metric_name.length > 0);

  } catch (err) {
    console.error('[MedicalExtractorAgent] Multimodal extraction failed:', err.message);
    throw err;
  }
}

function validateStatus(s) {
  const valid = ['normal', 'low', 'high', 'critical_low', 'critical_high'];
  return valid.includes(s) ? s : 'normal';
}

function validateCategory(c) {
  const valid = ['hematology', 'biochemistry', 'lipid', 'thyroid', 'diabetes', 'vitamin', 'hormone', 'other'];
  return valid.includes(c) ? c : 'other';
}

function detectReportType(text) {
  const lower = text.toLowerCase();
  if (lower.includes('hemoglobin') || lower.includes('complete blood count') || lower.includes('cbc') || lower.includes('wbc')) return 'CBC';
  if (lower.includes('ldl') || lower.includes('hdl') || lower.includes('cholesterol') || lower.includes('lipid')) return 'Lipid Profile';
  if (lower.includes('hba1c') || lower.includes('glycated') || lower.includes('fasting glucose') || lower.includes('diabetes')) return 'Blood Sugar';
  if (lower.includes('tsh') || lower.includes('thyroid') || lower.includes('t3') || lower.includes('t4')) return 'Thyroid Panel';
  if (lower.includes('vitamin d') || lower.includes('25-oh') || lower.includes('vitamin b12') || lower.includes('b-12')) return 'Vitamin Panel';
  if (lower.includes('creatinine') || lower.includes('egfr') || lower.includes('kidney')) return 'Kidney Function';
  if (lower.includes('sgpt') || lower.includes('sgot') || lower.includes('liver') || lower.includes('bilirubin')) return 'Liver Function';
  return 'General Lab';
}

function getReportCategory(reportType) {
  const map = {
    'CBC': 'Hematology',
    'Lipid Profile': 'Biochemistry',
    'Blood Sugar': 'Diabetes',
    'Thyroid Panel': 'Endocrinology',
    'Vitamin Panel': 'Nutrition',
    'Kidney Function': 'Nephrology',
    'Liver Function': 'Hepatology',
    'General Lab': 'General',
  };
  return map[reportType] || 'General';
}

module.exports = {
  extractMetrics,
  extractMetricsMultimodal,
  detectReportType,
  getReportCategory,
};
