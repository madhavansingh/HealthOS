const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ReportRepository = require('../database/repositories/ReportRepository');
const InsightRepository = require('../database/repositories/InsightRepository');
const TimelineRepository = require('../database/repositories/TimelineRepository');
const EventRepository = require('../database/repositories/EventRepository');
const storageConfig = require('../config/storage');
const { processReport, rebuildHealthScores } = require('./reportProcessor');

class ReportsService {
  static async uploadReport(file, customName, userId = 'default-user') {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const reportId = uuidv4();
    const reportName = customName || path.basename(file.originalname, path.extname(file.originalname));

    ReportRepository.create({
      id: reportId,
      user_id: userId,
      name: reportName,
      file_path: file.path,
      file_name: file.originalname,
      status: 'processing'
    });

    // Run processing pipeline in background
    processReport(reportId, file.path, userId).catch(err => {
      console.error('[ReportsService] Background pipeline error:', err.message);
    });

    return {
      success: true,
      reportId,
      message: 'Report uploaded. AI analysis started...'
    };
  }

  static async loadDemoReport(scenario, userId = 'default-user') {
    let srcFilename;
    let displayName;

    switch (scenario) {
      case 'healthy-adult':
        srcFilename = 'healthy-adult-report.pdf';
        displayName = 'Healthy Profile (Demo)';
        break;
      case 'vitamin-d':
        srcFilename = 'vitamin-d-deficiency-report.pdf';
        displayName = 'Vitamin D Deficiency (Demo)';
        break;
      case 'metabolic-risk':
        srcFilename = 'metabolic-risk-report.pdf';
        displayName = 'Metabolic Risk (Demo)';
        break;
      default:
        throw new Error('Invalid demo scenario');
    }

    const srcPath = path.join(storageConfig.demoDocsDir, srcFilename);
    if (!fs.existsSync(srcPath)) {
      throw new Error(`Demo file not found at ${srcPath}`);
    }

    const reportId = uuidv4();
    const destFilename = `${reportId}-demo-${srcFilename}`;
    const destDir = storageConfig.uploadsDir;

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destPath = path.join(destDir, destFilename);
    fs.copyFileSync(srcPath, destPath);

    ReportRepository.create({
      id: reportId,
      user_id: userId,
      name: displayName,
      file_path: destPath,
      file_name: srcFilename,
      status: 'processing'
    });

    // Run processing pipeline in background
    processReport(reportId, destPath, userId).catch(err => {
      console.error('[ReportsService] Background demo pipeline error:', err.message);
    });

    return {
      success: true,
      reportId,
      message: 'Demo report loaded. AI analysis started...'
    };
  }

  static getReports(userId = 'default-user') {
    const list = ReportRepository.findByUserId(userId);
    return list.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type || 'General',
      date: this.formatDate(r.uploaded_at),
      status: r.status,
      lab: r.lab || 'Uploaded Lab',
      insights: r.insight_count || 0,
      abnormal: r.abnormal_count || 0,
      metricCount: r.metric_count || 0,
    }));
  }

  static getReportDetails(reportId) {
    const report = ReportRepository.findById(reportId);
    if (!report) return null;

    const metrics = ReportRepository.getMetricsByReportId(reportId);
    const insights = InsightRepository.getInsightsByUserId('default-user').filter(i => i.report_id === reportId);

    return {
      report: {
        ...report,
        date: this.formatDate(report.uploaded_at),
      },
      metrics,
      insights,
    };
  }

  static getReportStatus(reportId) {
    const report = ReportRepository.findById(reportId);
    if (!report) return null;

    const meta = ReportRepository.getProcessingMeta(reportId);
    let metricsPreview = meta.metricsPreview || [];
    let metricCount = 0;

    if (report.status === 'analyzed' || report.status === 'partial') {
      const metrics = ReportRepository.getMetricsByReportId(reportId);
      metricCount = metrics.length;
      metricsPreview = metrics.slice(0, 8);
    }

    return {
      id: report.id,
      status: report.status,
      analyzedAt: report.analyzed_at,
      documentType: meta.documentType || report.type || null,
      classificationConfidence: meta.classificationConfidence || null,
      pipeline: meta.pipeline || null,
      ocrConfidence: meta.ocrConfidence || null,
      ocrSuccess: meta.ocrSuccess ?? null,
      visionSuccess: meta.visionSuccess ?? null,
      textSnippet: meta.textSnippet || null,
      medicinesDetected: meta.medicinesDetected || [],
      metricCount,
      metricsPreview,
      errorReason: meta.errorReason || null,
      partialSuccess: meta.partialSuccess || false,
      completedSteps: meta.completedSteps || [],
      ocrStatus: meta.ocrStatus || null,
      metricExtractionStatus: meta.metricExtractionStatus || null,
      clinicalRulesStatus: meta.clinicalRulesStatus || null,
      geminiStatus: meta.geminiStatus || null,
      aiFallback: meta.aiFallback || false,
    };
  }

  static async deleteReport(reportId, userId = 'default-user') {
    ReportRepository.deleteMetricsByReportId(reportId);
    InsightRepository.deleteInsightsByReportId(reportId);
    TimelineRepository.deleteVitalsByReportId(reportId);
    EventRepository.deleteEventsByReportId(reportId);
    ReportRepository.delete(reportId);

    const { getDb } = require('../database/connection');
    await rebuildHealthScores(userId);
    return { success: true };
  }

  static getReportComparison(baseId, compareId, userId = 'default-user') {
    let latestReport, previousReport;

    if (baseId && compareId) {
      latestReport = ReportRepository.findById(compareId);
      previousReport = ReportRepository.findById(baseId);
    } else {
      const reports = ReportRepository.findByUserId(userId).filter(r => r.status === 'analyzed');
      if (reports.length < 2) {
        return { latestReport: null, previousReport: null, comparisons: [] };
      }
      latestReport = reports[0];
      previousReport = reports[1];
    }

    if (!latestReport || !previousReport) {
      return { latestReport: null, previousReport: null, comparisons: [] };
    }

    const latestMetrics = ReportRepository.getMetricsByReportId(latestReport.id);
    const previousMetrics = ReportRepository.getMetricsByReportId(previousReport.id);

    const prevMap = {};
    for (const m of previousMetrics) {
      prevMap[m.metric_name.toLowerCase()] = m;
    }

    const comparisonList = [];

    for (const curr of latestMetrics) {
      const prev = prevMap[curr.metric_name.toLowerCase()];
      if (prev && typeof curr.value === 'number' && typeof prev.value === 'number') {
        const diff = curr.value - prev.value;
        const pct = prev.value !== 0 ? Math.round((diff / prev.value) * 100) : 0;
        
        let direction = 'stable';
        let status = 'stable';
        const normName = curr.metric_name.toLowerCase();
        
        if (diff > 0.01) direction = 'up';
        else if (diff < -0.01) direction = 'down';

        if (normName.includes('vitamin') || normName.includes('hdl') || normName.includes('hemoglobin') || normName.includes('calcium')) {
          if (direction === 'up') status = 'improved';
          else if (direction === 'down') status = 'declining';
        } else {
          if (direction === 'down') status = 'improved';
          else if (direction === 'up') status = 'declining';
        }

        comparisonList.push({
          metric: curr.metric_name,
          currentValue: curr.value,
          previousValue: prev.value,
          unit: curr.unit,
          diff: parseFloat(diff.toFixed(2)),
          percentage: pct,
          direction,
          status,
        });
      }
    }

    return {
      latestReport: { id: latestReport.id, name: latestReport.name, date: this.formatDate(latestReport.uploaded_at) },
      previousReport: { id: previousReport.id, name: previousReport.name, date: this.formatDate(previousReport.uploaded_at) },
      comparisons: comparisonList
    };
  }

  static formatDate(iso) {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

module.exports = ReportsService;
