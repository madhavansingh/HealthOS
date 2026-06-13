const express = require('express');
const SimulatorController = require('../controllers/simulatorController');

const router = express.Router();

router.get('/story', SimulatorController.getStory);

module.exports = router;
