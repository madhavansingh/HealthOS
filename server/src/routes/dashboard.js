const express = require('express');
const DashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.get('/summary', DashboardController.getSummary);

module.exports = router;
