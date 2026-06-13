const express = require('express');
const SimulatorController = require('../controllers/simulatorController');

const router = express.Router();

router.get('/preventive', SimulatorController.getPreventive);

module.exports = router;
