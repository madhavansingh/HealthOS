const { v4: uuidv4 } = require('uuid');
const path = require('path');
const Tesseract = require('tesseract.js');
const { getDb } = require('../db/database');
const { extractTextFromPDF, cleanMedicalText } = require('./pdfExtractor');
const { extractMetrics, extractMetricsMultimodal, detectReportType, getReportCategory } = require('../agents/medicalExtractor');
const { classifyDocument } = require('../agents/documentRouter');
const { extractPrescription } = require('../agents/prescriptionExtractor');
const { generateTrendInsights, buildTimeline } = require('../agents/trendIntelligence');
const { GeminiQuotaError } = require('../agents/geminiClient');
const { generateFallbackInsights } = require('./fallbackEngine');

/**
 * Persist a partial metadata snapshot so the status endpoint can serve
 * rich incremental state to the Processing UX — even mid-pipeline.
 */
function saveMeta(db, reportId, patch) {
  const existing = db.prepare('SELECT processing_meta FROM reports WHERE id = ?').get(reportId);
  let meta = {};
  try { if (existing?.processing_meta) meta = JSON.parse(existing.processing_meta); } catch (_) {}
  const updated = { ...meta, ...patch };
  db.prepare('UPDATE reports SET processing_meta = ? WHERE id = ?')
    .run(JSON.stringify(updated), reportId);
}

/**
 * Main Report Processing Pipeline
 * Classification → File Routing → Extract (Text / OCR / Vision) → DB Storage → Insights
 */
async function processReport(reportId, filePath, userId = 'default-user') {
  const db = getDb();

  try {
    db.prepare('UPDATE reports SET status = ? WHERE id = ?').run('processing', reportId);
    saveMeta(db, reportId, {
      ocrStatus: 'pending',
      metricExtractionStatus: 'pending',
      clinicalRulesStatus: 'pending',
      geminiStatus: 'success',
      completedSteps: []
    });

    const reportInfo = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
    const originalName = reportInfo?.file_name || path.basename(filePath);

    // ── Step 1: Document Classification ──────────────────────────────────
    console.log(`[Pipeline] Classifying: ${originalName}`);
    const classification = await classifyDocument(filePath, originalName);
    console.log(`[Pipeline] Type: ${classification.documentType}  pipeline: ${classification.pipeline}  isMedical: ${classification.isMedicalDocument}`);

    // If document is not medical, stop pipeline immediately
    if (classification.isMedicalDocument === false) {
      console.log(`[Pipeline] Non-medical document detected: ${classification.documentType} (confidence: ${classification.confidence})`);
      saveMeta(db, reportId, {
        isMedicalDocument: false,
        documentType: classification.documentType,
        classificationConfidence: classification.confidence,
        completedSteps: ['classify'],
        ocrStatus: 'skipped',
        metricExtractionStatus: 'skipped',
        clinicalRulesStatus: 'skipped',
        geminiStatus: 'skipped',
      });
      db.prepare('UPDATE reports SET status = ? WHERE id = ?').run('unsupported', reportId);
      return { success: false, reason: 'unsupported' };
    }

    // Check if confidence is below a threshold for medical documents
    const CONFIDENCE_THRESHOLD = 0.65;
    if (classification.confidence < CONFIDENCE_THRESHOLD) {
      console.log(`[Pipeline] Low confidence medical document: ${classification.documentType} (confidence: ${classification.confidence})`);
      saveMeta(db, reportId, {
        isMedicalDocument: true,
        lowConfidence: true,
        documentType: classification.documentType,
        classificationConfidence: classification.confidence,
        completedSteps: ['classify'],
        ocrStatus: 'skipped',
        metricExtractionStatus: 'skipped',
        clinicalRulesStatus: 'skipped',
        geminiStatus: 'skipped',
      });
      db.prepare('UPDATE reports SET status = ? WHERE id = ?').run('low_confidence', reportId);
      return { success: false, reason: 'low_confidence' };
    }

    saveMeta(db, reportId, {
      isMedicalDocument: true,
      documentType: classification.documentType,
      pipeline: classification.pipeline,
      classificationConfidence: classification.confidence,
      completedSteps: ['classify'],
    });

    let rawMetrics = [];
    let reportType = 'General Lab';
    let reportCategory = 'General';

    // ── Step 2: Pipeline Routing ─────────────────────────────────────────
    if (classification.pipeline === 'text_pdf') {
      console.log(`[Pipeline] → text_pdf`);
      const { text } = await extractTextFromPDF(filePath);
      const cleanedText = cleanMedicalText(text);

      if (cleanedText.trim().length < 50) {
        // fall back to vision
        classification.pipeline = 'scanned_pdf';
        saveMeta(db, reportId, { pipeline: 'scanned_pdf' });
      } else {
        const textSnippet = cleanedText.slice(0, 300).replace(/\s+/g, ' ').trim();
        reportType = detectReportType(cleanedText);
        reportCategory = getReportCategory(reportType);

        saveMeta(db, reportId, {
          ocrSuccess: true,
          ocrConfidence: 1.0,
          ocrStatus: 'skipped',
          textSnippet,
          documentType: reportType,
          completedSteps: ['classify', 'ocr'],
        });

        try {
          rawMetrics = await extractMetrics(cleanedText, reportType);
          rawMetrics = rawMetrics.map(m => ({ ...m, confidence: 0.98, source: 'text_pdf' }));
        } catch (extractErr) {
          console.warn(`[Pipeline] Gemini extractMetrics failed: ${extractErr.message}. Trying regex fallback.`);
          const isQuota = extractErr.isQuotaError || String(extractErr.message).includes('429') || String(extractErr.message).toLowerCase().includes('quota');
          const { extractMetricsRegex } = require('./fallbackEngine');
          rawMetrics = extractMetricsRegex(cleanedText);
          saveMeta(db, reportId, { 
            geminiStatus: isQuota ? 'quota_exceeded' : 'failed',
            aiFallback: true,
          });
        }

        saveMeta(db, reportId, {
          visionSuccess: rawMetrics.length > 0,
          completedSteps: ['classify', 'ocr', 'vision', 'biomarkers'],
        });
      }
    }

    if (classification.pipeline === 'scanned_pdf') {
      console.log(`[Pipeline] → scanned_pdf`);
      reportType = 'Scanned Lab Report';
      reportCategory = 'General';

      saveMeta(db, reportId, { completedSteps: ['classify', 'vision'], ocrStatus: 'processing' });

      try {
        const extracted = await extractMetricsMultimodal(filePath, originalName, 'scanned_pdf');
        rawMetrics = extracted.map(m => ({ ...m, source: 'vision' }));
        saveMeta(db, reportId, { ocrSuccess: true, ocrStatus: 'success' });
      } catch (visErr) {
        console.warn(`[Pipeline] Gemini scanned_pdf extract failed: ${visErr.message}. Trying OCR + regex fallback.`);
        const isQuota = visErr.isQuotaError || String(visErr.message).includes('429') || String(visErr.message).toLowerCase().includes('quota');
        saveMeta(db, reportId, { 
          geminiStatus: isQuota ? 'quota_exceeded' : 'failed',
          aiFallback: true,
        });

        // Tesseract OCR fallback
        try {
          const result = await Tesseract.recognize(filePath, 'eng');
          const ocrText = result.data.text || '';
          const ocrConfidence = (result.data.confidence || 0) / 100;
          const ocrSuccess = ocrText.trim().length > 30 && ocrConfidence >= 0.70;
          const textSnippet = ocrText.slice(0, 300).replace(/\s+/g, ' ').trim();
          
          saveMeta(db, reportId, {
            ocrSuccess,
            ocrConfidence,
            ocrStatus: ocrSuccess ? 'success' : 'failed',
            textSnippet
          });

          if (ocrSuccess) {
            const { extractMetricsRegex } = require('./fallbackEngine');
            rawMetrics = extractMetricsRegex(ocrText);
          }
        } catch (ocrErr) {
          console.warn(`[Pipeline] OCR fallback failed: ${ocrErr.message}`);
          saveMeta(db, reportId, { ocrStatus: 'failed' });
        }
      }

      saveMeta(db, reportId, {
        visionSuccess: rawMetrics.length > 0,
        completedSteps: ['classify', 'ocr', 'vision', 'biomarkers'],
      });
    }

    if (classification.pipeline === 'vision_ocr') {
      console.log(`[Pipeline] → vision_ocr (hybrid)`);
      let ocrText = '';
      let ocrMetrics = [];
      let ocrConfidence = 0;

      // Tesseract OCR
      try {
        saveMeta(db, reportId, { completedSteps: ['classify', 'ocr'], ocrStatus: 'processing' });
        const result = await Tesseract.recognize(filePath, 'eng');
        ocrText = result.data.text || '';
        ocrConfidence = (result.data.confidence || 0) / 100;
        const ocrSuccess = ocrText.trim().length > 30 && ocrConfidence >= 0.70;
        const textSnippet = ocrText.slice(0, 300).replace(/\s+/g, ' ').trim();

        saveMeta(db, reportId, { ocrSuccess, ocrConfidence, textSnippet, completedSteps: ['classify', 'ocr'], ocrStatus: ocrSuccess ? 'success' : 'failed' });

        if (ocrSuccess) {
          const ocrType = detectReportType(ocrText);
          try {
            ocrMetrics = await extractMetrics(ocrText, ocrType);
            ocrMetrics = ocrMetrics.map(m => ({ ...m, confidence: ocrConfidence, source: 'ocr' }));
            reportType = ocrType;
            reportCategory = getReportCategory(reportType);
          } catch (extractErr) {
            console.warn(`[Pipeline] OCR extract metrics failed: ${extractErr.message}. Trying regex extraction.`);
            const isQuota = extractErr.isQuotaError || String(extractErr.message).includes('429') || String(extractErr.message).toLowerCase().includes('quota');
            saveMeta(db, reportId, { 
              geminiStatus: isQuota ? 'quota_exceeded' : 'failed',
              aiFallback: true,
            });
            const { extractMetricsRegex } = require('./fallbackEngine');
            ocrMetrics = extractMetricsRegex(ocrText);
            reportType = ocrType;
            reportCategory = getReportCategory(reportType);
          }
        }
      } catch (ocrErr) {
        console.warn(`[Pipeline] OCR failed: ${ocrErr.message}`);
        saveMeta(db, reportId, { ocrSuccess: false, ocrStatus: 'failed' });
      }

      // Gemini Vision
      saveMeta(db, reportId, { completedSteps: ['classify', 'ocr', 'vision'] });
      let visionMetrics = [];
      try {
        visionMetrics = await extractMetricsMultimodal(filePath, originalName, 'image');
      } catch (visErr) {
        console.error(`[Pipeline] Vision failed: ${visErr.message}`);
        const isQuota = visErr.isQuotaError || String(visErr.message).includes('429') || String(visErr.message).toLowerCase().includes('quota');
        saveMeta(db, reportId, { 
          geminiStatus: isQuota ? 'quota_exceeded' : 'failed',
          aiFallback: true,
        });
        if (ocrMetrics.length === 0) throw visErr;
      }

      // Hybrid merge
      const mergedMap = new Map();
      for (const vm of visionMetrics) {
        mergedMap.set(vm.metric_name.toLowerCase().replace(/[^a-z0-9]/g, ''), vm);
      }
      for (const om of ocrMetrics) {
        const key = om.metric_name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (mergedMap.has(key)) {
          const vm = mergedMap.get(key);
          if (Math.abs((vm.value || 0) - (om.value || 0)) < 0.05) {
            vm.confidence = Math.min(1.0, Math.max(vm.confidence, om.confidence) + 0.05);
            vm.source = 'hybrid';
          } else {
            vm.confidence = Math.max(0.5, vm.confidence - 0.1);
          }
          mergedMap.set(key, vm);
        } else {
          mergedMap.set(key, om);
        }
      }
      rawMetrics = Array.from(mergedMap.values());

      saveMeta(db, reportId, {
        visionSuccess: rawMetrics.length > 0,
        completedSteps: ['classify', 'ocr', 'vision', 'biomarkers'],
      });
    }

    if (classification.pipeline === 'vision_prescription') {
      console.log(`[Pipeline] → vision_prescription`);
      reportType = 'Prescription';
      reportCategory = 'General';
      saveMeta(db, reportId, { completedSteps: ['classify', 'vision'], ocrStatus: 'skipped' });

      let rx = { medications: [], tests: [], symptoms: [], instructions: [] };
      try {
        rx = await extractPrescription(filePath, originalName);
      } catch (rxErr) {
        console.warn(`[Pipeline] extractPrescription failed: ${rxErr.message}. Trying OCR + regex fallback.`);
        const isQuota = rxErr.isQuotaError || String(rxErr.message).includes('429') || String(rxErr.message).toLowerCase().includes('quota');
        saveMeta(db, reportId, { 
          geminiStatus: isQuota ? 'quota_exceeded' : 'failed',
          aiFallback: true,
        });

        // Run Tesseract to get text for prescription
        try {
          const result = await Tesseract.recognize(filePath, 'eng');
          const ocrText = result.data.text || '';
          const { extractPrescriptionRegex } = require('./fallbackEngine');
          rx = extractPrescriptionRegex(ocrText);
        } catch (ocrErr) {
          console.warn(`[Pipeline] OCR fallback for prescription failed: ${ocrErr.message}`);
        }
      }

      const medicinesDetected = rx.medications.map(m => m.name).filter(Boolean);

      saveMeta(db, reportId, {
        ocrSuccess: true,
        visionSuccess: true,
        documentType: 'Prescription',
        medicinesDetected,
        completedSteps: ['classify', 'ocr', 'vision', 'biomarkers'],
      });

      for (const med of rx.medications) {
        rawMetrics.push({ metric_name: `Medication: ${med.name}`, value: null, value_text: `${med.dosage || ''} ${med.frequency || ''}`.trim() || 'Active', unit: null, reference_low: null, reference_high: null, status: 'normal', category: 'other', confidence: med.confidence || 0.90, source: 'vision_prescription' });
      }
      for (const t of rx.tests) {
        rawMetrics.push({ metric_name: `Recommended Test: ${t.name}`, value: null, value_text: 'Recommended', unit: null, reference_low: null, reference_high: null, status: 'normal', category: 'other', confidence: t.confidence || 0.90, source: 'vision_prescription' });
      }
      for (const s of rx.symptoms) {
        rawMetrics.push({ metric_name: `Symptom: ${s.name}`, value: null, value_text: 'Reported', unit: null, reference_low: null, reference_high: null, status: 'normal', category: 'other', confidence: s.confidence || 0.90, source: 'vision_prescription' });
      }
      for (const inst of rx.instructions) {
        rawMetrics.push({ metric_name: 'Instruction', value: null, value_text: inst.text, unit: null, reference_low: null, reference_high: null, status: 'normal', category: 'other', confidence: inst.confidence || 0.90, source: 'vision_prescription' });
      }
    }

    // ── Step 3: Store Metrics ────────────────────────────────────────────
    db.prepare('UPDATE reports SET type = ? WHERE id = ?').run(reportCategory, reportId);

    const { evaluateMetric } = require('./clinicalRules');
    const metrics = rawMetrics.map(m => {
      if (m.value !== null && !m.metric_name.startsWith('Medication:') && !m.metric_name.startsWith('Recommended') && !m.metric_name.startsWith('Symptom:')) {
        const ev = evaluateMetric(m.metric_name, m.value, 'Male');
        return { ...m, metric_name: ev.metric_name || m.metric_name, status: ev.status || m.status, reference_low: ev.reference_low !== null ? ev.reference_low : m.reference_low, reference_high: ev.reference_high !== null ? ev.reference_high : m.reference_high };
      }
      return m;
    });

    const insertMetric = db.prepare(`INSERT INTO report_metrics (id, report_id, metric_name, value, value_text, unit, reference_low, reference_high, status, category, confidence, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    db.transaction((list) => {
      for (const m of list) insertMetric.run(uuidv4(), reportId, m.metric_name, m.value, m.value_text, m.unit, m.reference_low, m.reference_high, m.status, m.category, m.confidence || 1.0, m.source || 'text_pdf');
    })(metrics);

    saveMeta(db, reportId, {
      metricExtractionStatus: metrics.length > 0 ? 'success' : 'failed',
      clinicalRulesStatus: 'success',
    });

    const reportDate = new Date().toISOString().split('T')[0];
    addToTimeline(db, userId, reportId, reportDate, metrics);

    // ── Step 4: AI Insights (with graceful Gemini fallback) ──────────────
    saveMeta(db, reportId, { completedSteps: ['classify', 'ocr', 'vision', 'biomarkers', 'insights'] });
    const allMetrics = db.prepare('SELECT * FROM report_metrics WHERE report_id = ?').all(reportId);

    let insights = [];
    let insightSource = 'gemini';

    try {
      insights = await generateTrendInsights(
        { id: userId, age: 34, gender: 'Male' },
        [{ date: reportDate, metrics: allMetrics }],
        [{ name: reportInfo?.name || 'Report', type: reportCategory, date: reportDate }]
      );
    } catch (insightErr) {
      const isQuota = insightErr.isQuotaError || 
        String(insightErr.message || '').toLowerCase().includes('quota') ||
        String(insightErr.message || '').includes('429');

      console.warn(`[Pipeline] Gemini quota/error hit — using fallback insights engine for ${reportId}: ${insightErr.message}`);
      insights = generateFallbackInsights(allMetrics);
      insightSource = 'clinical_rules';
      saveMeta(db, reportId, { 
        aiInsightsAvailable: false, 
        aiFallback: true,
        geminiStatus: isQuota ? 'quota_exceeded' : 'failed',
      });
    }

    const insertInsight = db.prepare(`INSERT INTO ai_insights (id, report_id, user_id, category, severity, title, description, metric, icon, sources) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    db.transaction((list) => {
      for (const ins of list) insertInsight.run(uuidv4(), reportId, userId, ins.category, ins.severity, ins.title, ins.description, ins.metric, ins.icon, JSON.stringify(ins.sources || []));
    })(insights);

    // Health event
    const abnormalCount = metrics.filter(m => m.status !== 'normal').length;
    db.prepare(`INSERT OR IGNORE INTO health_events (id, user_id, report_id, date, type, title, detail, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), userId, reportId, reportDate, 'report', `${reportInfo?.name || 'Lab Report'} Analyzed`, `${metrics.length} metrics · ${abnormalCount} findings · ${insights.length} insights`, '#6366f1');

    // ── Step 5: Finalize ─────────────────────────────────────────────────
    saveMeta(db, reportId, {
      completedSteps: ['classify', 'ocr', 'vision', 'biomarkers', 'insights', 'twin'],
      partialSuccess: metrics.length === 0,
      insightSource,
    });
    db.prepare('UPDATE reports SET status = ?, analyzed_at = ? WHERE id = ?')
      .run(metrics.length > 0 ? 'analyzed' : 'partial', new Date().toISOString(), reportId);

    await rebuildHealthScores(db, userId);

    console.log(`[Pipeline] ✅ ${reportId}: ${metrics.length} metrics, ${insights.length} insights (source: ${insightSource})`);
    return { success: true, metrics: metrics.length, insights: insights.length };

  } catch (error) {
    // Log full error server-side, NEVER expose raw messages to client
    console.error(`[Pipeline] ❌ ${reportId}:`, error.message);

    const isQuotaRelated = error.isQuotaError ||
      String(error.message || '').toLowerCase().includes('quota') ||
      String(error.message || '').includes('429');

    // Recovery path: if metrics exist in the DB, finalize using clinical rules fallback instead of setting status to 'error'
    const savedMetrics = db.prepare('SELECT * FROM report_metrics WHERE report_id = ?').all(reportId);
    if (savedMetrics && savedMetrics.length > 0) {
      console.log(`[Pipeline] Recovery triggered. Metrics exist (${savedMetrics.length}). Saving fallback twin/insights and marking analyzed.`);
      
      try {
        const reportDate = new Date().toISOString().split('T')[0];
        const insights = generateFallbackInsights(savedMetrics);
        
        // Clean out any existing insights to avoid duplicates on retry/recovery
        db.prepare('DELETE FROM ai_insights WHERE report_id = ?').run(reportId);
        
        const insertInsight = db.prepare(`INSERT INTO ai_insights (id, report_id, user_id, category, severity, title, description, metric, icon, sources) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        db.transaction((list) => {
          for (const ins of list) insertInsight.run(uuidv4(), reportId, userId, ins.category, ins.severity, ins.title, ins.description, ins.metric, ins.icon, JSON.stringify(ins.sources || []));
        })(insights);

        const abnormalCount = savedMetrics.filter(m => m.status !== 'normal').length;
        db.prepare(`INSERT OR IGNORE INTO health_events (id, user_id, report_id, date, type, title, detail, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(uuidv4(), userId, reportId, reportDate, 'report', `${reportInfo?.name || 'Lab Report'} Analyzed`, `${savedMetrics.length} metrics · ${abnormalCount} findings · ${insights.length} insights`, '#6366f1');

        saveMeta(db, reportId, {
          completedSteps: ['classify', 'ocr', 'vision', 'biomarkers', 'insights', 'twin'],
          partialSuccess: false,
          insightSource: 'clinical_rules',
          aiFallback: true,
          aiInsightsAvailable: false,
          geminiStatus: isQuotaRelated ? 'quota_exceeded' : 'failed',
          metricExtractionStatus: 'success',
          clinicalRulesStatus: 'success'
        });

        db.prepare('UPDATE reports SET status = ?, analyzed_at = ? WHERE id = ?')
          .run('analyzed', new Date().toISOString(), reportId);

        await rebuildHealthScores(db, userId);

        return { success: true, metrics: savedMetrics.length, insights: insights.length };
      } catch (recoveryErr) {
        console.error('[Pipeline] Recovery failed:', recoveryErr.message);
      }
    }

    const userFacingReason = isQuotaRelated
      ? 'AI analysis services are temporarily busy. Your document was read successfully — please try uploading again in a few minutes.'
      : 'We could not extract enough medical information from this document. Please try a clearer image or a different format.';

    saveMeta(db, reportId, { 
      errorReason: userFacingReason, 
      partialSuccess: false,
      geminiStatus: isQuotaRelated ? 'quota_exceeded' : 'failed',
      metricExtractionStatus: 'failed',
      clinicalRulesStatus: 'failed'
    });
    db.prepare('UPDATE reports SET status = ? WHERE id = ?').run('error', reportId);
  }
}

async function rebuildHealthScores(db, userId) {
  try {
    // 1. Delete all current health scores for the user
    db.prepare('DELETE FROM health_scores WHERE user_id = ?').run(userId);

    // 2. Fetch all reports that are analyzed or partial, sorted by uploaded_at
    const reports = db.prepare(`
      SELECT id, uploaded_at FROM reports
      WHERE user_id = ? AND status IN ('analyzed', 'partial')
      ORDER BY uploaded_at ASC
    `).all(userId);

    const { generateHealthTwin } = require('../agents/healthTwinGenerator');
    const { generateFallbackTwin } = require('./fallbackEngine');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const scoreHistory = [];

    for (const report of reports) {
      const reportDate = report.uploaded_at ? report.uploaded_at.split('T')[0] : new Date().toISOString().split('T')[0];
      
      // Get all metrics from reports uploaded on or before this report
      const metrics = db.prepare(`
        SELECT m.* FROM report_metrics m
        JOIN reports r ON r.id = m.report_id
        WHERE r.user_id = ? AND r.status IN ('analyzed', 'partial') AND r.uploaded_at <= ?
        ORDER BY r.uploaded_at ASC
      `).all(userId, report.uploaded_at);

      if (metrics.length === 0) continue;

      let twin;
      try {
        twin = await generateHealthTwin(user, metrics, scoreHistory);
      } catch (geminiErr) {
        twin = generateFallbackTwin(user, metrics);
      }

      const scoreId = uuidv4();
      const scoreRecord = {
        id: scoreId,
        user_id: userId,
        date: reportDate,
        overall: twin.overallScore,
        cardiovascular: twin.scoreBreakdown?.cardiovascular || 75,
        metabolic: twin.scoreBreakdown?.metabolic || 75,
        sleep: twin.scoreBreakdown?.sleep || 72,
        activity: twin.scoreBreakdown?.activity || 76,
        mental: twin.scoreBreakdown?.mental || 74,
        nutrition: twin.scoreBreakdown?.nutrition || twin.scoreBreakdown?.nutritional || 75
      };

      db.prepare(`
        INSERT INTO health_scores (id, user_id, date, overall, cardiovascular, metabolic, sleep, activity, mental, nutrition)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        scoreRecord.id,
        scoreRecord.user_id,
        scoreRecord.date,
        scoreRecord.overall,
        scoreRecord.cardiovascular,
        scoreRecord.metabolic,
        scoreRecord.sleep,
        scoreRecord.activity,
        scoreRecord.mental,
        scoreRecord.nutrition
      );

      scoreHistory.push(scoreRecord);
    }
    console.log(`[Database] Rebuilt score history for ${userId}: ${scoreHistory.length} records`);
  } catch (err) {
    console.error('[Database] Failed to rebuild health scores:', err.message);
  }
}

function addToTimeline(db, userId, reportId, date, metrics) {
  const TRACKED = ['Hemoglobin', 'LDL Cholesterol', 'HDL Cholesterol', 'Fasting Glucose',
    'HbA1c', 'TSH', 'Vitamin D', 'Vitamin B12', 'Triglycerides', 'Total Cholesterol',
    'Creatinine', 'Systolic Blood Pressure', 'Heart Rate', 'Body Weight'];

  const insert = db.prepare(`INSERT OR IGNORE INTO vitals_timeline (id, user_id, report_id, date, metric_name, value, unit) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  for (const m of metrics) {
    const tracked = TRACKED.some(t => m.metric_name.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(m.metric_name.toLowerCase()));
    if (tracked && m.value !== null) insert.run(uuidv4(), userId, reportId, date, m.metric_name, m.value, m.unit);
  }
}

module.exports = { processReport, rebuildHealthScores };
