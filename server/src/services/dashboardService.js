const UserRepository = require('../database/repositories/UserRepository');
const ReportRepository = require('../database/repositories/ReportRepository');
const TimelineRepository = require('../database/repositories/TimelineRepository');

class DashboardService {
  static getDashboardSummary(userId = 'default-user') {
    const user = UserRepository.findById(userId);
    const latestScore = TimelineRepository.getLatestScore(userId);
    const previousScore = TimelineRepository.getPreviousScore(userId);

    const reports = ReportRepository.findByUserId(userId) || [];
    const analyzedCount = reports.filter(r => r.status === 'analyzed' || r.status === 'partial').length;
    const totalInsights = reports.reduce((acc, r) => acc + (r.insight_count || 0), 0);

    const recentReports = reports.slice(0, 5);

    const scoreBreakdown = latestScore
      ? {
          cardiovascular: latestScore.cardiovascular,
          metabolic: latestScore.metabolic,
          sleep: latestScore.sleep,
          activity: latestScore.activity,
          mental: latestScore.mental,
          nutrition: latestScore.nutrition,
        }
      : { cardiovascular: 0, metabolic: 0, sleep: 0, activity: 0, mental: 0, nutrition: 0 };

    return {
      user: {
        name: user?.name || 'Guest User',
        age: user?.age || null,
        bloodType: user?.blood_type || '',
        plan: user?.plan || 'Basic Plan',
        location: user?.location || '',
        primaryDoctor: user?.primary_doctor || '',
      },
      healthScore: {
        overall: latestScore?.overall || 0,
        previousScore: previousScore?.overall || 0,
        breakdown: scoreBreakdown,
      },
      stats: {
        totalReports: reports.length,
        analyzedReports: analyzedCount,
        totalInsights: totalInsights,
        hasData: reports.length > 0,
      },
      recentReports: recentReports.map(r => ({
        id: r.id,
        name: r.name,
        type: r.type || 'General',
        date: this.formatDate(r.uploaded_at),
        status: r.status,
        insights: r.insight_count || 0,
        abnormal: r.abnormal_count || 0,
      })),
    };
  }

  static formatDate(iso) {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

module.exports = DashboardService;
