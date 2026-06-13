const express = require('express');
const SimulatorController = require('../controllers/simulatorController');

const router = express.Router();

router.get('/family', SimulatorController.getFamily);

module.exports = router;
