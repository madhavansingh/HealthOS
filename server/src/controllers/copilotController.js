const CopilotService = require('../services/copilotService');

class CopilotController {
  static async getBrief(req, res) {
    try {
      const brief = await CopilotService.getDoctorBrief('default-user');
      return res.json(brief);
    } catch (err) {
      console.error('[CopilotController] Brief error:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = CopilotController;
