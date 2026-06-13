const express = require('express');
const InsightsController = require('../controllers/insightsController');

const router = express.Router();

router.get('/trends', InsightsController.getTrends);
router.get('/twin', InsightsController.getTwin);
router.get('/summary', InsightsController.getSummary);

module.exports = router;
