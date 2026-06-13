const ReportsService = require('../services/reportsService');

class ReportsController {
  static async upload(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const customName = req.body.name || null;
      const result = await ReportsService.uploadReport(req.file, customName, 'default-user');

      return res.json(result);
    } catch (err) {
      console.error('[ReportsController] Upload error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async analyzeDemo(req, res) {
    try {
      const { scenario } = req.body;
      if (!scenario) {
        return res.status(400).json({ error: 'Scenario is required' });
      }

      const result = await ReportsService.loadDemoReport(scenario, 'default-user');
      return res.json(result);
    } catch (err) {
      console.error('[ReportsController] Demo load error:', err);
      if (err.message.includes('not found') || err.message.includes('Invalid')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  static async getReports(req, res) {
    try {
      const reports = ReportsService.getReports('default-user');
      return res.json({ reports, total: reports.length });
    } catch (err) {
      console.error('[ReportsController] Get reports error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async getReportDetails(req, res) {
    try {
      const result = ReportsService.getReportDetails(req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Report not found' });
      }
      return res.json(result);
    } catch (err) {
      console.error('[ReportsController] Get report details error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async getReportStatus(req, res) {
    try {
      const status = ReportsService.getReportStatus(req.params.id);
      if (!status) {
        return res.status(404).json({ error: 'Report not found' });
      }
      return res.json(status);
    } catch (err) {
      console.error('[ReportsController] Get report status error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async deleteReport(req, res) {
    try {
      const result = await ReportsService.deleteReport(req.params.id, 'default-user');
      return res.json(result);
    } catch (err) {
      console.error('[ReportsController] Delete report error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async getReportComparison(req, res) {
    try {
      const { baseReportId, compareReportId } = req.query;
      const result = ReportsService.getReportComparison(baseReportId, compareReportId, 'default-user');
      return res.json(result);
    } catch (err) {
      console.error('[ReportsController] Comparison error:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = ReportsController;
