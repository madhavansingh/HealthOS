const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { streamHealthChat } = require('../agents/doctorCopilot');

const router = express.Router();

// POST /api/chat/message — Streaming SSE chat
router.post('/message', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const sid = sessionId || uuidv4();
  const db = getDb();

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Store user message
  db.prepare(`
    INSERT INTO chat_messages (id, session_id, user_id, role, content)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), sid, 'default-user', 'user', message);

  // Gather health context
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get('default-user');
  const metrics = db.prepare(`
    SELECT m.metric_name, m.value, m.unit, m.status
    FROM report_metrics m
    JOIN reports r ON r.id = m.report_id
    WHERE r.user_id = 'default-user' AND r.status IN ('analyzed', 'partial')
    ORDER BY m.created_at DESC
    LIMIT 30
  `).all();
  const insights = db.prepare(`
    SELECT i.title, i.description, i.severity FROM ai_insights i
    JOIN reports r ON r.id = i.report_id
    WHERE i.user_id = 'default-user' AND r.status IN ('analyzed', 'partial')
    ORDER BY i.created_at DESC LIMIT 5
  `).all();
  const reportCount = db.prepare("SELECT COUNT(*) as c FROM reports WHERE user_id = ? AND status IN ('analyzed', 'partial')").get('default-user');

  const history = db.prepare(`
    SELECT role, content FROM chat_messages
    WHERE session_id = ? AND user_id = 'default-user'
    ORDER BY created_at DESC LIMIT 12
  `).all(sid).reverse();

  // Stream AI response
  let fullResponse = '';

  try {
    const stream = streamHealthChat(
      user || { name: 'Arjun', age: 34, gender: 'Male' },
      { metrics, insights, reportCount: reportCount?.c || 0 },
      history.slice(0, -1), // Exclude the message we just added
      message
    );

    for await (const chunk of stream) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    // Store AI response
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, user_id, role, content)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), sid, 'default-user', 'assistant', fullResponse);

    res.write(`data: ${JSON.stringify({ done: true, sessionId: sid })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Chat error:', err.message);
    const fallback = `I'm having trouble connecting to my analysis systems right now. Please check that your GEMINI_API_KEY is configured in server/.env. Your question: "${message}" — I'll be ready to answer once connected!`;
    res.write(`data: ${JSON.stringify({ chunk: fallback })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true, sessionId: sid, error: true })}\n\n`);
    res.end();
  }
});

// GET /api/chat/history/:sessionId
router.get('/history/:sessionId', (req, res) => {
  const db = getDb();
  const messages = db.prepare(`
    SELECT role, content, created_at FROM chat_messages
    WHERE session_id = ? AND user_id = 'default-user'
    ORDER BY created_at ASC
  `).all(req.params.sessionId);

  res.json({
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
      time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    })),
  });
});

module.exports = router;
