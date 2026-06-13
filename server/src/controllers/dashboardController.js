const DashboardService = require('../services/dashboardService');

class DashboardController {
  static async getSummary(req, res) {
    try {
      const summary = DashboardService.getDashboardSummary('default-user');
      return res.json(summary);
    } catch (err) {
      console.error('[DashboardController] Summary error:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = DashboardController;
