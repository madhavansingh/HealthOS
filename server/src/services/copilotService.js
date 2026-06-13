const UserRepository = require('../database/repositories/UserRepository');
const ReportRepository = require('../database/repositories/ReportRepository');
const InsightRepository = require('../database/repositories/InsightRepository');
const FamilyRepository = require('../database/repositories/FamilyRepository');
const { generateDoctorBrief } = require('../agents/doctorCopilotAgent');
const { generateFallbackDoctorBrief } = require('../pipeline/fallbackEngine');

class CopilotService {
  static async getDoctorBrief(userId = 'default-user') {
    const user = UserRepository.findById(userId);
    const recentMetrics = ReportRepository.getRecentMetrics(userId, 40);
    const insights = InsightRepository.getInsightsByUserId(userId, 10);
    const family = FamilyRepository.findByUserId(userId);

    if (recentMetrics.length === 0) {
      return {
        visitBrief: null,
        suggestedQuestions: [],
        questions: [],
        summary: 'Upload medical reports to generate your Doctor Copilot brief.',
        discussionTopics: [],
        redFlags: [],
        followUpTests: []
      };
    }

    let brief;
    try {
      brief = await generateDoctorBrief(user, recentMetrics, insights, family);
      // Normalize field names for frontend compatibility
      brief.questions = brief.suggestedQuestions || [];
      brief.summary = brief.reportSummary || '';
      brief.checklist = brief.visitChecklist || [
        'Bring all recent lab reports',
        'List current medications and supplements',
        'Note any symptoms or changes since last visit',
      ];
    } catch (geminiErr) {
      console.warn('[Copilot Service] Gemini unavailable — using fallback brief:', geminiErr.message);
      brief = generateFallbackDoctorBrief(recentMetrics);
    }

    return brief;
  }
}

module.exports = CopilotService;
