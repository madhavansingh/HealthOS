const express = require('express');
const CopilotController = require('../controllers/copilotController');

const router = express.Router();

router.get('/brief', CopilotController.getBrief);

module.exports = router;
