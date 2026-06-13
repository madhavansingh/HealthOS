const express = require('express');
const SimulatorController = require('../controllers/simulatorController');

const router = express.Router();

router.get('/vitals', SimulatorController.getVitals);
router.get('/events', SimulatorController.getEvents);

module.exports = router;
