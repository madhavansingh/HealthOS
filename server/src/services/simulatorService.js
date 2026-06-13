const UserRepository = require('../database/repositories/UserRepository');
const ReportRepository = require('../database/repositories/ReportRepository');
const InsightRepository = require('../database/repositories/InsightRepository');
const TimelineRepository = require('../database/repositories/TimelineRepository');
const EventRepository = require('../database/repositories/EventRepository');
const PreventiveRepository = require('../database/repositories/PreventiveRepository');
const FamilyRepository = require('../database/repositories/FamilyRepository');

const { generateForecast } = require('../agents/futureSimulatorAgent');
const { generateHealthGraph, generateHealthStory } = require('../agents/healthTwinAgent');
const { generateFallbackForecast } = require('../pipeline/fallbackEngine');

class SimulatorService {
  static async getForecast(scenario = 'combined', userId = 'default-user') {
    const user = UserRepository.findById(userId);
    const currentMetrics = ReportRepository.getRecentMetrics(userId, 30);
    const scoreHistory = TimelineRepository.getHealthScores(userId);

    if (currentMetrics.length === 0) {
      return {
        forecast: [],
        confidence: '0%',
        projectedOutcomes: {
          healthScoreChange: '',
          biologicalAgeChange: '',
          keyImprovements: [],
          timeToGoal: ''
        },
        disclaimer: 'No data to simulate. Please upload medical reports first.'
      };
    }

    let forecast;
    try {
      forecast = await generateForecast(user, currentMetrics, scoreHistory, scenario);
    } catch (geminiErr) {
      console.warn('[Simulator Service] Gemini unavailable — using deterministic forecast:', geminiErr.message);
      forecast = generateFallbackForecast(currentMetrics, scenario);
    }

    return forecast;
  }

  static async getHealthGraph(userId = 'default-user') {
    const user = UserRepository.findById(userId);
    const allMetrics = ReportRepository.getRecentMetrics(userId, 50);
    const insights = InsightRepository.getInsightsByUserId(userId, 10);

    if (allMetrics.length === 0) {
      return { nodes: [], edges: [] };
    }

    try {
      return await generateHealthGraph(user, allMetrics, insights);
    } catch (err) {
      console.error('[Simulator Service] Graph error:', err.message);
      return { nodes: [], edges: [], error: err.message };
    }
  }

  static async getHealthStory(userId = 'default-user') {
    const user = UserRepository.findById(userId);
    const events = EventRepository.findByUserId(userId, 20);
    const scores = TimelineRepository.getHealthScores(userId);
    const insights = InsightRepository.getInsightsByUserId(userId, 5);

    if (events.length === 0) {
      return {
        story: "Your Health Journey is empty. Upload medical reports to write your health history story.",
        milestones: []
      };
    }

    try {
      return await generateHealthStory(user, events, scores, insights);
    } catch (err) {
      console.error('[Simulator Service] Story error:', err.message);
      return {
        story: "Your Health Journey is empty. Upload medical reports to write your health history story.",
        milestones: []
      };
    }
  }

  static getTimelineVitals(userId = 'default-user') {
    const vitals = TimelineRepository.getTimelineVitals(userId);
    const scores = TimelineRepository.getHealthScores(userId);

    // Group vitals by date for chart format
    const byDate = {};
    for (const v of vitals) {
      if (!byDate[v.date]) byDate[v.date] = { date: v.date };
      const key = v.metric_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      byDate[v.date][key] = v.value;
      byDate[v.date][key + '_unit'] = v.unit;
    }

    const formattedVitals = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

    if (formattedVitals.length === 0) {
      return { vitals: [], scores: [], hasData: false };
    }

    return { vitals: formattedVitals, scores, hasData: true };
  }

  static getTimelineEvents(userId = 'default-user') {
    const events = EventRepository.findByUserId(userId, 20);
    return { events };
  }

  static getPreventiveCare(userId = 'default-user') {
    const items = PreventiveRepository.findByUserId(userId);
    return { items };
  }

  static getFamilyMembers(userId = 'default-user') {
    const members = FamilyRepository.findByUserId(userId);
    return {
      members: members.map(m => ({
        ...m,
        conditions: typeof m.conditions === 'string' ? JSON.parse(m.conditions || '[]') : (m.conditions || []),
      }))
    };
  }

  static async getMissionControl(userId = 'default-user') {
    const user = UserRepository.findById(userId);
    const metrics = ReportRepository.getRecentMetrics(userId, 30);
    const insights = InsightRepository.getInsightsByUserId(userId, 10);

    if (metrics.length === 0) {
      return [];
    }

    const { generateMissionControl } = require('../agents/healthTwinAgent');
    return await generateMissionControl(user, metrics, insights);
  }

  static async getTwinHistory(userId = 'default-user') {
    const user = UserRepository.findById(userId);
    const scoreHistory = TimelineRepository.getHealthScores(userId);
    const healthEvents = EventRepository.findByUserId(userId, 20);

    if (scoreHistory.length === 0) {
      return { scoreHistory: [], healthEvents: [] };
    }

    const { generateTwinHistory } = require('../agents/healthTwinAgent');
    return await generateTwinHistory(user, scoreHistory, healthEvents);
  }
}

module.exports = SimulatorService;
