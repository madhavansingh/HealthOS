const express = require('express');
const SimulatorController = require('../controllers/simulatorController');

const router = express.Router();

router.get('/graph', SimulatorController.getGraph);

module.exports = router;
