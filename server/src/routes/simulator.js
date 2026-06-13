const express = require('express');
const SimulatorController = require('../controllers/simulatorController');

const router = express.Router();

router.post('/simulator', SimulatorController.getForecast);

module.exports = router;
