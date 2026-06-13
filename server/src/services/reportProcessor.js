const path = require('path');
const Tesseract = require('tesseract.js');
const { getDb } = require('../database/connection');
const ReportRepository = require('../database/repositories/ReportRepository');
const InsightRepository = require('../database/repositories/InsightRepository');
const UserRepository = require('../database/repositories/UserRepository');
const TimelineRepository = require('../database/repositories/TimelineRepository');
const EventRepository = require('../database/repositories/EventRepository');

const { extractTextFromPDF, cleanMedicalText } = require('../pipeline/pdfExtractor');
const { extractMetrics, extractMetricsMultimodal, detectReportType, getReportCategory } = require('../agents/medicalExtractorAgent');
const { classifyDocument } = require('../agents/documentClassifierAgent');
const { extractPrescription } = require('../agents/prescriptionExtractorAgent');
const { generateTrendInsights } = require('../agents/trendIntelligenceAgent');
const { generateFallbackInsights, generateFallbackTwin } = require('../pipeline/fallbackEngine');
const { evaluateMetric } = require('../pipeline/clinicalRules');

/**
 * Persist a partial metadata snapshot so the status endpoint can serve
 * rich incremental state to the Processing UX — even mid-pipeline.
 */
function saveMeta(reportId, patch) {
  const meta = ReportRepository.getProcessingMeta(reportId);
  const updated = { ...meta, ...patch };
  ReportRepository.updateProcessingMeta(reportId, updated);
}

/**
 * Main Report Processing Pipeline
 * Classification → File Routing → Extract (Text / OCR / Vision) → DB Storage → Insights
 */
async function processReport(reportId, filePath, userId = 'default-user') {
  const db = getDb();

  try {
    ReportRepository.updateStatus(reportId, 'processing');
    saveMeta(reportId, {
      ocrStatus: 'pending',
      metricExtractionStatus: 'pending',
      clinicalRulesStatus: 'pending',
      geminiStatus: 'success',
      completedSteps: []
    });

    const reportInfo = ReportRepository.findById(reportId);
    const originalName = reportInfo?.file_name || path.basename(filePath);

    // ── Step 1: Document Classification ──────────────────────────────────
    console.log(`[Pipeline] Classifying: ${originalName}`);
    const classification = await classifyDocument(filePath, originalName);
    console.log(`[Pipeline] Type: ${classification.documentType}  pipeline: ${classification.pipeline}  isMedical: ${classification.isMedicalDocument}`);

    // If document is not medical, stop pipeline immediately
    if (classification.isMedicalDocument === false) {
      console.log(`[Pipeline] Non-medical document detected: ${classification.documentType} (confidence: ${classification.confidence})`);
      saveMeta(reportId, {
        isMedicalDocument: false,
        documentType: classification.documentType,
        classificationConfidence: classification.confidence,
        completedSteps: ['classify'],
        ocrStatus: 'skipped',
        metricExtractionStatus: 'skipped',
        clinicalRulesStatus: 'skipped',
        geminiStatus: 'skipped',
      });
      ReportRepository.updateStatus(reportId, 'unsupported');
      return { success: false, reason: 'unsupported' };
    }

    // Check if confidence is below a threshold for medical documents
    const CONFIDENCE_THRESHOLD = 0.65;
    if (classification.confidence < CONFIDENCE_THRESHOLD) {
      console.log(`[Pipeline] Low confidence medical document: ${classification.documentType} (confidence: ${classification.confidence})`);
      saveMeta(reportId, {
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
      ReportRepository.updateStatus(reportId, 'low_confidence');
      return { success: false, reason: 'low_confidence' };
    }

    saveMeta(reportId, {
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
        saveMeta(reportId, { pipeline: 'scanned_pdf' });
      } else {
        const textSnippet = cleanedText.slice(0, 300).replace(/\s+/g, ' ').trim();
        reportType = detectReportType(cleanedText);
        reportCategory = getReportCategory(reportType);

        saveMeta(reportId, {
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
          const { extractMetricsRegex } = require('../pipeline/fallbackEngine');
          rawMetrics = extractMetricsRegex(cleanedText);
          saveMeta(reportId, { 
            geminiStatus: isQuota ? 'quota_exceeded' : 'failed',
            aiFallback: true,
          });
        }

        saveMeta(reportId, {
          visionSuccess: rawMetrics.length > 0,
          completedSteps: ['classify', 'ocr', 'vision', 'biomarkers'],
        });
      }
    }

    if (classification.pipeline === 'scanned_pdf') {
      console.log(`[Pipeline] → scanned_pdf`);
      reportType = 'Scanned Lab Report';
      reportCategory = 'General';

      saveMeta(reportId, { completedSteps: ['classify', 'vision'], ocrStatus: 'processing' });

      try {
        const extracted = await extractMetricsMultimodal(filePath, originalName, 'scanned_pdf');
        rawMetrics = extracted.map(m => ({ ...m, source: 'vision' }));
        saveMeta(reportId, { ocrSuccess: true, ocrStatus: 'success' });
      } catch (visErr) {
        console.warn(`[Pipeline] Gemini scanned_pdf extract failed: ${visErr.message}. Trying OCR + regex fallback.`);
        const isQuota = visErr.isQuotaError || String(visErr.message).includes('429') || String(visErr.message).toLowerCase().includes('quota');
        saveMeta(reportId, { 
          geminiStatus: isQuota ? 'quota_exceeded' : 'failed',
          aiFallback: true,
        });

        // Tesseract OCR fallback
        try {
          const ext = path.extname(originalName || filePath).toLowerCase();
          const isSupportedImage = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'].includes(ext);
          if (!isSupportedImage) {
            throw new Error(`Tesseract OCR not supported for file extension: ${ext}`);
          }
          const result = await Tesseract.recognize(filePath, 'eng');
          const ocrText = result.data.text || '';
          const ocrConfidence = (result.data.confidence || 0) / 100;
          const ocrSuccess = ocrText.trim().length > 30 && ocrConfidence >= 0.70;
          const textSnippet = ocrText.slice(0, 300).replace(/\s+/g, ' ').trim();
          
          saveMeta(reportId, {
            ocrSuccess,
            ocrConfidence,
            ocrStatus: ocrSuccess ? 'success' : 'failed',
            textSnippet
          });

          if (ocrSuccess) {
            const { extractMetricsRegex } = require('../pipeline/fallbackEngine');
            rawMetrics = extractMetricsRegex(ocrText);
          }
        } catch (ocrErr) {
          console.warn(`[Pipeline] OCR fallback failed: ${ocrErr.message}`);
          saveMeta(reportId, { ocrStatus: 'failed' });
        }
      }

      saveMeta(reportId, {
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
        saveMeta(reportId, { completedSteps: ['classify', 'ocr'], ocrStatus: 'processing' });
        const ext = path.extname(originalName || filePath).toLowerCase();
        const isSupportedImage = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'].includes(ext);
        if (!isSupportedImage) {
          throw new Error(`Tesseract OCR not supported for file extension: ${ext}`);
        }
        const result = await Tesseract.recognize(filePath, 'eng');
        ocrText = result.data.text || '';
        ocrConfidence = (result.data.confidence || 0) / 100;
        const ocrSuccess = ocrText.trim().length > 30 && ocrConfidence >= 0.70;
        const textSnippet = ocrText.slice(0, 300).replace(/\s+/g, ' ').trim();

        saveMeta(reportId, { ocrSuccess, ocrConfidence, textSnippet, completedSteps: ['classify', 'ocr'], ocrStatus: ocrSuccess ? 'success' : 'failed' });

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
            saveMeta(reportId, { 
              geminiStatus: isQuota ? 'quota_exceeded' : 'failed',
              aiFallback: true,
            });
            const { extractMetricsRegex } = require('../pipeline/fallbackEngine');
            ocrMetrics = extractMetricsRegex(ocrText);
            reportType = ocrType;
            reportCategory = getReportCategory(reportType);
          }
        }
      } catch (ocrErr) {
        console.warn(`[Pipeline] OCR failed: ${ocrErr.message}`);
        saveMeta(reportId, { ocrSuccess: false, ocrStatus: 'failed' });
      }

      // Gemini Vision
      saveMeta(reportId, { completedSteps: ['classify', 'ocr', 'vision'] });
      let visionMetrics = [];
      try {
        visionMetrics = await extractMetricsMultimodal(filePath, originalName, 'image');
      } catch (visErr) {
        console.error(`[Pipeline] Vision failed: ${visErr.message}`);
        const isQuota = visErr.isQuotaError || String(visErr.message).includes('429') || String(visErr.message).toLowerCase().includes('quota');
        saveMeta(reportId, { 
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

      saveMeta(reportId, {
        visionSuccess: rawMetrics.length > 0,
        completedSteps: ['classify', 'ocr', 'vision', 'biomarkers'],
      });
    }

    if (classification.pipeline === 'vision_prescription') {
      console.log(`[Pipeline] → vision_prescription`);
      reportType = 'Prescription';
      reportCategory = 'General';
      saveMeta(reportId, { completedSteps: ['classify', 'vision'], ocrStatus: 'skipped' });

      let rx = { medications: [], tests: [], symptoms: [], instructions: [] };
      try {
        rx = await extractPrescription(filePath, originalName);
      } catch (rxErr) {
        console.warn(`[Pipeline] extractPrescription failed: ${rxErr.message}. Trying OCR + regex fallback.`);
        const isQuota = rxErr.isQuotaError || String(rxErr.message).includes('429') || String(rxErr.message).toLowerCase().includes('quota');
        saveMeta(reportId, { 
          geminiStatus: isQuota ? 'quota_exceeded' : 'failed',
          aiFallback: true,
        });

        // Run Tesseract to get text for prescription
        try {
          const result = await Tesseract.recognize(filePath, 'eng');
          const ocrText = result.data.text || '';
          const { extractPrescriptionRegex } = require('../pipeline/fallbackEngine');
          rx = extractPrescriptionRegex(ocrText);
        } catch (ocrErr) {
          console.warn(`[Pipeline] OCR fallback for prescription failed: ${ocrErr.message}`);
        }
      }

      const medicinesDetected = rx.medications.map(m => m.name).filter(Boolean);

      saveMeta(reportId, {
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
    const reportUpdateData = ReportRepository.findById(reportId);
    if (reportUpdateData) {
      db.prepare('UPDATE reports SET type = ? WHERE id = ?').run(reportCategory, reportId);
    }

    const metrics = rawMetrics.map(m => {
      if (m.value !== null && !m.metric_name.startsWith('Medication:') && !m.metric_name.startsWith('Recommended') && !m.metric_name.startsWith('Symptom:')) {
        const ev = evaluateMetric(m.metric_name, m.value, 'Male');
        return { 
          ...m, 
          metric_name: ev.metric_name || m.metric_name, 
          status: ev.status || m.status, 
          reference_low: ev.reference_low !== null ? ev.reference_low : m.reference_low, 
          reference_high: ev.reference_high !== null ? ev.reference_high : m.reference_high 
        };
      }
      return m;
    });

    db.transaction((list) => {
      for (const m of list) {
        ReportRepository.addMetric({
          report_id: reportId,
          metric_name: m.metric_name,
          value: m.value,
          value_text: m.value_text,
          unit: m.unit,
          reference_low: m.reference_low,
          reference_high: m.reference_high,
          status: m.status,
          category: m.category,
          confidence: m.confidence,
          source: m.source
        });
      }
    })(metrics);

    saveMeta(reportId, {
      metricExtractionStatus: metrics.length > 0 ? 'success' : 'failed',
      clinicalRulesStatus: 'success',
    });

    const reportDate = new Date().toISOString().split('T')[0];
    addToTimeline(userId, reportId, reportDate, metrics);

    // ── Step 4: AI Insights (with graceful Gemini fallback) ──────────────
    saveMeta(reportId, { completedSteps: ['classify', 'ocr', 'vision', 'biomarkers', 'insights'] });
    const allMetrics = ReportRepository.getMetricsByReportId(reportId);

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

      console.warn(`[Pipeline] Gemini quota/error hit — using fallback insights for ${reportId}: ${insightErr.message}`);
      insights = generateFallbackInsights(allMetrics);
      insightSource = 'clinical_rules';
      saveMeta(reportId, { 
        aiInsightsAvailable: false, 
        aiFallback: true,
        geminiStatus: isQuota ? 'quota_exceeded' : 'failed',
      });
    }

    db.transaction((list) => {
      for (const ins of list) {
        InsightRepository.addInsight({
          report_id: reportId,
          user_id: userId,
          category: ins.category,
          severity: ins.severity,
          title: ins.title,
          description: ins.description,
          metric: ins.metric,
          icon: ins.icon,
          sources: ins.sources
        });
      }
    })(insights);

    // Health event
    const abnormalCount = metrics.filter(m => m.status !== 'normal').length;
    EventRepository.addEvent({
      user_id: userId,
      report_id: reportId,
      date: reportDate,
      type: 'report',
      title: `${reportInfo?.name || 'Lab Report'} Analyzed`,
      detail: `${metrics.length} metrics · ${abnormalCount} findings · ${insights.length} insights`,
      color: '#6366f1'
    });

    // ── Step 5: Finalize ─────────────────────────────────────────────────
    saveMeta(reportId, {
      completedSteps: ['classify', 'ocr', 'vision', 'biomarkers', 'insights', 'twin'],
      partialSuccess: metrics.length === 0,
      insightSource,
    });
    
    ReportRepository.updateStatus(reportId, metrics.length > 0 ? 'analyzed' : 'partial');
    await rebuildHealthScores(userId);

    console.log(`[Pipeline] ✅ ${reportId}: ${metrics.length} metrics, ${insights.length} insights (source: ${insightSource})`);
    return { success: true, metrics: metrics.length, insights: insights.length };

  } catch (error) {
    console.error(`[Pipeline] ❌ ${reportId}:`, error.message);

    const isQuotaRelated = error.isQuotaError ||
      String(error.message || '').toLowerCase().includes('quota') ||
      String(error.message || '').includes('429');

    // Recovery path: if metrics exist in the DB, finalize using clinical rules fallback
    const savedMetrics = ReportRepository.getMetricsByReportId(reportId);
    if (savedMetrics && savedMetrics.length > 0) {
      console.log(`[Pipeline] Recovery triggered. Metrics exist (${savedMetrics.length}). Saving fallback twin/insights and marking analyzed.`);
      
      try {
        const reportDate = new Date().toISOString().split('T')[0];
        const insights = generateFallbackInsights(savedMetrics);
        
        InsightRepository.deleteInsightsByReportId(reportId);
        
        db.transaction((list) => {
          for (const ins of list) {
            InsightRepository.addInsight({
              report_id: reportId,
              user_id: userId,
              category: ins.category,
              assistant: ins.assistant,
              severity: ins.severity,
              title: ins.title,
              description: ins.description,
              metric: ins.metric,
              icon: ins.icon,
              sources: ins.sources
            });
          }
        })(insights);

        const reportInfo = ReportRepository.findById(reportId);
        const abnormalCount = savedMetrics.filter(m => m.status !== 'normal').length;
        EventRepository.addEvent({
          user_id: userId,
          report_id: reportId,
          date: reportDate,
          type: 'report',
          title: `${reportInfo?.name || 'Lab Report'} Analyzed`,
          detail: `${savedMetrics.length} metrics · ${abnormalCount} findings · ${insights.length} insights`,
          color: '#6366f1'
        });

        saveMeta(reportId, {
          completedSteps: ['classify', 'ocr', 'vision', 'biomarkers', 'insights', 'twin'],
          partialSuccess: false,
          insightSource: 'clinical_rules',
          aiFallback: true,
          aiInsightsAvailable: false,
          geminiStatus: isQuotaRelated ? 'quota_exceeded' : 'failed',
          metricExtractionStatus: 'success',
          clinicalRulesStatus: 'success'
        });

        ReportRepository.updateStatus(reportId, 'analyzed');
        await rebuildHealthScores(userId);

        return { success: true, metrics: savedMetrics.length, insights: insights.length };
      } catch (recoveryErr) {
        console.error('[Pipeline] Recovery failed:', recoveryErr.message);
      }
    }

    const userFacingReason = isQuotaRelated
      ? 'AI analysis services are temporarily busy. Your document was read successfully — please try uploading again in a few minutes.'
      : 'We could not extract enough medical information from this document. Please try a clearer image or a different format.';

    saveMeta(reportId, { 
      errorReason: userFacingReason, 
      partialSuccess: false,
      geminiStatus: isQuotaRelated ? 'quota_exceeded' : 'failed',
      metricExtractionStatus: 'failed',
      clinicalRulesStatus: 'failed'
    });
    ReportRepository.updateStatus(reportId, 'error');
  }
}

async function rebuildHealthScores(userId) {
  try {
    const db = getDb();
    TimelineRepository.deleteScoresByUserId(userId);

    const reports = db.prepare(`
      SELECT id, uploaded_at FROM reports
      WHERE user_id = ? AND status IN ('analyzed', 'partial')
      ORDER BY uploaded_at ASC
    `).all(userId);

    const { generateHealthTwin } = require('../agents/healthTwinAgent');
    const user = UserRepository.findById(userId) || { id: userId, name: 'Guest', age: 34, gender: 'Male' };
    const scoreHistory = [];

    for (const report of reports) {
      const reportDate = report.uploaded_at ? report.uploaded_at.split('T')[0] : new Date().toISOString().split('T')[0];
      
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

      const scoreRecord = {
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

      TimelineRepository.addHealthScore(scoreRecord);
      scoreHistory.push(scoreRecord);
    }
    console.log(`[Database] Rebuilt score history for ${userId}: ${scoreHistory.length} records`);
  } catch (err) {
    console.error('[Database] Failed to rebuild health scores:', err.message);
  }
}

function addToTimeline(userId, reportId, date, metrics) {
  const TRACKED = ['Hemoglobin', 'LDL Cholesterol', 'HDL Cholesterol', 'Fasting Glucose',
    'HbA1c', 'TSH', 'Vitamin D', 'Vitamin B12', 'Triglycerides', 'Total Cholesterol',
    'Creatinine', 'Systolic Blood Pressure', 'Heart Rate', 'Body Weight'];

  for (const m of metrics) {
    const tracked = TRACKED.some(t => m.metric_name.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(m.metric_name.toLowerCase()));
    if (tracked && m.value !== null) {
      TimelineRepository.addVital({
        user_id: userId,
        report_id: reportId,
        date,
        metric_name: m.metric_name,
        value: m.value,
        unit: m.unit
      });
    }
  }
}

module.exports = { processReport, rebuildHealthScores };
