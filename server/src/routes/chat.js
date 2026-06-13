const express = require('express');
const ChatController = require('../controllers/chatController');

const router = express.Router();

router.post('/message', ChatController.sendMessage);
router.get('/history/:sessionId', ChatController.getHistory);

module.exports = router;
