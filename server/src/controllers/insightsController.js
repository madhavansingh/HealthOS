const InsightsService = require('../services/insightsService');

class InsightsController {
  static async getTrends(req, res) {
    try {
      const result = await InsightsService.getTrendInsights('default-user');
      return res.json(result);
    } catch (err) {
      console.error('[InsightsController] Get trends error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async getTwin(req, res) {
    try {
      const result = await InsightsService.getHealthTwin('default-user');
      return res.json(result);
    } catch (err) {
      console.error('[InsightsController] Get twin error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async getSummary(req, res) {
    try {
      const result = InsightsService.getSummary('default-user');
      return res.json(result);
    } catch (err) {
      console.error('[InsightsController] Get summary error:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = InsightsController;
