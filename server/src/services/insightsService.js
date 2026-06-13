const UserRepository = require('../database/repositories/UserRepository');
const ReportRepository = require('../database/repositories/ReportRepository');
const InsightRepository = require('../database/repositories/InsightRepository');
const TimelineRepository = require('../database/repositories/TimelineRepository');
const { generateTrendInsights } = require('../agents/trendIntelligenceAgent');
const { generateHealthTwin } = require('../agents/healthTwinAgent');
const { generateFallbackTwin, generateFallbackInsights } = require('../pipeline/fallbackEngine');

class InsightsService {
  static async getTrendInsights(userId = 'default-user') {
    // Get stored insights first (fast path)
    const stored = InsightRepository.getInsightsByUserId(userId, 20);

    if (stored.length > 0) {
      return {
        insights: stored.map(this.formatInsight),
        cached: true,
        count: stored.length,
      };
    }

    // If no stored insights, generate fresh
    const allMetrics = ReportRepository.getAllMetrics(userId);

    if (allMetrics.length === 0) {
      return { insights: [], demo: false };
    }

    const user = UserRepository.findById(userId);
    const reports = ReportRepository.findByUserId(userId).filter(r => r.status === 'analyzed' || r.status === 'partial');

    let insights;
    try {
      insights = await generateTrendInsights(
        user,
        [{ date: 'recent', metrics: allMetrics }],
        reports.slice(0, 5)
      );
    } catch (geminiErr) {
      console.warn('[Insights Service] Gemini unavailable — using fallback engine:', geminiErr.message);
      insights = generateFallbackInsights(allMetrics);
    }

    return { insights, fresh: true };
  }

  static async getHealthTwin(userId = 'default-user') {
    const user = UserRepository.findById(userId);
    const allMetrics = ReportRepository.getAllMetrics(userId);
    const scoreHistory = TimelineRepository.getHealthScores(userId);

    if (allMetrics.length === 0) {
      return { overallScore: 0, biomarkers: [], keyStrengths: [], keyRisks: [], twinSummary: '', dataPoints: 0, reportsCovered: 0 };
    }

    let twin;
    try {
      twin = await generateHealthTwin(user, allMetrics, scoreHistory);
    } catch (geminiErr) {
      console.warn('[Twin Service] Gemini unavailable — using fallback engine:', geminiErr.message);
      twin = generateFallbackTwin(user, allMetrics);
    }

    // Map field names the frontend expects
    return {
      ...twin,
      biomarkers: twin.biomarkers || allMetrics.map(m => ({
        name: m.metric_name,
        value: m.value,
        unit: m.unit || '',
        status: m.status || 'normal',
        referenceRange: m.reference_low != null && m.reference_high != null
          ? `${m.reference_low}\u2013${m.reference_high}`
          : null,
      })),
      strengths: twin.keyStrengths || twin.strengths || [],
      healthStory: twin.twinSummary || twin.healthStory || '',
    };
  }

  static getSummary(userId = 'default-user') {
    const insights = InsightRepository.getInsightsByUserId(userId, 5);

    return {
      insights: insights.length > 0 ? insights.map(this.formatInsight) : [],
      count: insights.length,
    };
  }

  static formatInsight(i) {
    let parsedSources = [];
    try {
      parsedSources = typeof i.sources === 'string' ? JSON.parse(i.sources || '[]') : (i.sources || []);
    } catch (e) {
      parsedSources = [];
    }

    return {
      id: i.id,
      category: i.category,
      severity: i.severity,
      title: i.title,
      description: i.description,
      metric: i.metric,
      icon: i.icon || 'activity',
      sources: parsedSources,
      reportName: i.report_name,
      date: i.created_at?.split('T')[0],
    };
  }
}

module.exports = InsightsService;
