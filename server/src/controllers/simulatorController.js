const SimulatorService = require('../services/simulatorService');

class SimulatorController {
  static async getForecast(req, res) {
    try {
      const { scenario } = req.body;
      const forecast = await SimulatorService.getForecast(scenario, 'default-user');
      return res.json(forecast);
    } catch (err) {
      console.error('[SimulatorController] Forecast error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async getGraph(req, res) {
    try {
      const graph = await SimulatorService.getHealthGraph('default-user');
      return res.json(graph);
    } catch (err) {
      console.error('[SimulatorController] Graph error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async getStory(req, res) {
    try {
      const story = await SimulatorService.getHealthStory('default-user');
      return res.json(story);
    } catch (err) {
      console.error('[SimulatorController] Story error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async getVitals(req, res) {
    try {
      const vitals = SimulatorService.getTimelineVitals('default-user');
      return res.json(vitals);
    } catch (err) {
      console.error('[SimulatorController] Vitals error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async getEvents(req, res) {
    try {
      const events = SimulatorService.getTimelineEvents('default-user');
      return res.json(events);
    } catch (err) {
      console.error('[SimulatorController] Events error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async getPreventive(req, res) {
    try {
      const items = SimulatorService.getPreventiveCare('default-user');
      return res.json(items);
    } catch (err) {
      console.error('[SimulatorController] Preventive care error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async getFamily(req, res) {
    try {
      const members = SimulatorService.getFamilyMembers('default-user');
      return res.json(members);
    } catch (err) {
      console.error('[SimulatorController] Family error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async getMissionControl(req, res) {
    try {
      const result = await SimulatorService.getMissionControl('default-user');
      return res.json(result);
    } catch (err) {
      console.error('[SimulatorController] Mission control error:', err);
      return res.json([]);
    }
  }

  static async getTwinHistory(req, res) {
    try {
      const result = await SimulatorService.getTwinHistory('default-user');
      return res.json(result);
    } catch (err) {
      console.error('[SimulatorController] Twin history error:', err);
      return res.json({ scoreHistory: [], healthEvents: [] });
    }
  }
}

module.exports = SimulatorController;
