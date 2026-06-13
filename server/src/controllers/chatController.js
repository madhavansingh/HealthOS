const ChatService = require('../services/chatService');

class ChatController {
  static async getHistory(req, res) {
    try {
      const messages = ChatService.getChatHistory(req.params.sessionId, 'default-user');
      return res.json({ messages });
    } catch (err) {
      console.error('[ChatController] History error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async sendMessage(req, res) {
    try {
      const { message, sessionId } = req.body;
      if (!message?.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const stream = ChatService.streamChatResponse(message, sessionId, 'default-user');

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      res.end();
    } catch (err) {
      console.error('[ChatController] Send message error:', err);
      if (!res.headersSent) {
        return res.status(500).json({ error: err.message });
      }
      res.write(`data: ${JSON.stringify({ error: true, chunk: err.message })}\n\n`);
      res.end();
    }
  }
}

module.exports = ChatController;
