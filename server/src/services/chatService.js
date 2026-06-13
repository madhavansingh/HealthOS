const { randomUUID } = require('crypto');
const ChatRepository = require('../database/repositories/ChatRepository');
const UserRepository = require('../database/repositories/UserRepository');
const ReportRepository = require('../database/repositories/ReportRepository');
const InsightRepository = require('../database/repositories/InsightRepository');
const { streamHealthChat } = require('../agents/chatAgent');

class ChatService {
  static getChatHistory(sessionId, userId = 'default-user') {
    const messages = ChatRepository.getSessionMessages(sessionId, userId);
    return messages.map(m => ({
      role: m.role,
      content: m.content,
      time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
  }

  static async *streamChatResponse(message, sessionId, userId = 'default-user') {
    const sid = sessionId || randomUUID();

    // Store user message
    ChatRepository.addMessage({
      sessionId: sid,
      userId,
      role: 'user',
      content: message,
    });

    // Gather health context
    const user = UserRepository.findById(userId) || { name: 'Arjun', age: 34, gender: 'Male' };
    const metrics = ReportRepository.getRecentMetrics(userId, 30);
    const insights = InsightRepository.getInsightsByUserId(userId, 5);
    
    const reports = ReportRepository.findByUserId(userId) || [];
    const reportCount = reports.filter(r => r.status === 'analyzed' || r.status === 'partial').length;

    const messages = ChatRepository.getSessionMessages(sid, userId);
    // History should exclude the message we just added
    const history = messages.slice(0, -1).map(m => ({
      role: m.role,
      content: m.content
    }));

    // Stream generator from AI
    const stream = streamHealthChat(
      user,
      { metrics, insights, reportCount },
      history,
      message
    );

    let fullResponse = '';
    try {
      for await (const chunk of stream) {
        fullResponse += chunk;
        yield { chunk, sessionId: sid };
      }

      // Store AI response
      ChatRepository.addMessage({
        sessionId: sid,
        userId,
        role: 'assistant',
        content: fullResponse,
      });

      yield { done: true, sessionId: sid };

    } catch (err) {
      console.error('[Chat Service] Error:', err.message);
      const fallback = `I'm having trouble connecting to my analysis systems right now. Please check that your GEMINI_API_KEY is configured in server/.env. Your question: "${message}" — I'll be ready to answer once connected!`;
      
      // Store fallback response
      ChatRepository.addMessage({
        sessionId: sid,
        userId,
        role: 'assistant',
        content: fallback,
      });

      yield { chunk: fallback, error: true };
      yield { done: true, sessionId: sid, error: true };
    }
  }
}

module.exports = ChatService;
