const express = require('express');
const router = express.Router();
const db = require('../db');
const { callGemini } = require('../ai');
const { authMiddleware } = require('../middleware/auth');
const { awardXP } = require('../lib/xp');
const { checkAiLimit } = require('./ai');

// LARE Algorithm: calculates priority score for a topic
function calcLarePriority(topic) {
  const today = new Date();

  // U: Exam Urgency
  const daysUntilExam = Math.ceil((new Date(topic.exam_date) - today) / 86400000);
  let U = 20;
  if (daysUntilExam <= 5)       U = 100;
  else if (daysUntilExam <= 10) U = 80;
  else if (daysUntilExam <= 20) U = 60;
  else if (daysUntilExam <= 30) U = 40;

  // D: Difficulty Rating (1-5 → 20-100)
  const D = topic.difficulty * 20;

  // E: Error Rate from quiz performance
  const E = topic.quiz_total > 0
    ? (1 - topic.quiz_correct / topic.quiz_total) * 100
    : 50;

  // R: Revision Gap
  let R = 100;
  if (topic.last_revised_at) {
    const daysSince = Math.floor((today - new Date(topic.last_revised_at)) / 86400000);
    if (daysSince <= 1)      R = 10;
    else if (daysSince <= 3) R = 40;
    else if (daysSince <= 7) R = 70;
  }

  const score = 0.35 * U + 0.30 * D + 0.20 * E + 0.15 * R;
  return { score: Math.round(score), U, D, E, R, daysUntilExam };
}

// GET /api/lare
router.get('/', authMiddleware, async (req, res) => {
  try {
    const topics = await db.getLareTopics(req.user.id);
    const ranked = topics
      .map(t => ({ ...t, ...calcLarePriority(t) }))
      .sort((a, b) => b.score - a.score);
    res.json(ranked);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/lare
router.post('/', authMiddleware, async (req, res) => {
  const { subject, topic, examDate, difficulty } = req.body;
  if (!subject || !topic || !examDate) return res.status(400).json({ error: 'subject, topic, and examDate required' });
  try {
    const t = await db.createLareTopic({
      user_id: req.user.id, subject, topic,
      exam_date: examDate, difficulty: difficulty || 3,
    });
    res.json({ ...t, ...calcLarePriority(t) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/lare/:id
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const t = await db.updateLareTopic(req.params.id, req.user.id, req.body);
    res.json({ ...t, ...calcLarePriority(t) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/lare/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await db.deleteLareTopic(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/lare/:id/generate
router.post('/:id/generate', authMiddleware, checkAiLimit('tutor'), async (req, res) => {
  try {
    const topics = await db.getLareTopics(req.user.id);
    const topic = topics.find(t => t.id === req.params.id);
    if (!topic) return res.status(404).json({ error: 'Topic not found' });

    const quizPct = topic.quiz_total > 0
      ? Math.round((topic.quiz_correct / topic.quiz_total) * 100)
      : null;
    const diffLabel = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'][topic.difficulty];

    const prompt = `You are an expert ${topic.subject} tutor for a high school student.

Topic: ${topic.topic}
Subject: ${topic.subject}
Difficulty rating: ${diffLabel} (${topic.difficulty}/5)
${quizPct !== null ? `Previous quiz score: ${quizPct}%` : 'No quiz taken yet'}

Generate personalised learning content in the following JSON format ONLY:
{
  "explanation": "Clear 3-4 paragraph explanation with real-world examples",
  "revision_notes": ["key point 1", "key point 2", "key point 3", "key point 4", "key point 5"],
  "common_mistakes": ["mistake 1", "mistake 2", "mistake 3"],
  "quiz": [
    { "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A", "explanation": "..." },
    { "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "B", "explanation": "..." },
    { "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "C", "explanation": "..." },
    { "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A", "explanation": "..." },
    { "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "D", "explanation": "..." }
  ],
  "flashcards": [
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
  ]
}`;

    const result = await callGemini(prompt);
    if (result.error) return res.status(503).json({ error: result.error });

    try {
      const content = JSON.parse(result.text.match(/\{[\s\S]*\}/)[0]);
      await db.updateLareTopic(topic.id, req.user.id, {
        last_revised_at: new Date().toISOString(),
        revision_count: (topic.revision_count || 0) + 1,
      });
      await awardXP(req.user.id, 10);
      res.json(content);
    } catch {
      res.status(500).json({ error: 'Failed to parse AI content. Try again.' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/lare/:id/quiz-result
router.post('/:id/quiz-result', authMiddleware, async (req, res) => {
  try {
    const { correct, total } = req.body;
    const topics = await db.getLareTopics(req.user.id);
    const topic = topics.find(t => t.id === req.params.id);
    if (!topic) return res.status(404).json({ error: 'Topic not found' });

    const updated = await db.updateLareTopic(topic.id, req.user.id, {
      quiz_correct: topic.quiz_correct + correct,
      quiz_total: topic.quiz_total + total,
      last_revised_at: new Date().toISOString(),
    });
    await awardXP(req.user.id, correct * 10);
    res.json({ ...updated, ...calcLarePriority(updated) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
