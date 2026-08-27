const express = require('express');
const router = express.Router();
const db = require('../db');
const { callGemini } = require('../ai');
const { authMiddleware } = require('../middleware/auth');
const { awardXP } = require('../lib/xp');
const { checkAiLimit } = require('./ai');

// GET /api/flashcards
router.get('/', authMiddleware, async (req, res) => {
  try {
    res.json(await db.getFlashcards(req.user.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/flashcards
router.post('/', authMiddleware, async (req, res) => {
  const { subject, question, answer } = req.body;
  if (!subject || !question || !answer) return res.status(400).json({ error: 'All fields required' });
  try {
    const card = await db.createFlashcard({ user_id: req.user.id, subject, question, answer });
    await awardXP(req.user.id, 2);
    res.json(card);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/flashcards/generate
router.post('/generate', authMiddleware, checkAiLimit('flashcard_generate'), async (req, res) => {
  const { subject, topic, count = 5 } = req.body;
  const prompt = `Generate ${count} flashcards for "${topic}" in ${subject} for high school students.
Return ONLY valid JSON: { "flashcards": [{ "question": "...", "answer": "..." }] }`;
  const result = await callGemini(prompt);
  if (result.error) return res.status(503).json({ error: result.error });
  try {
    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)[0]);
    const cards = await Promise.all(
      parsed.flashcards.map(c =>
        db.createFlashcard({ user_id: req.user.id, subject, question: c.question, answer: c.answer })
      )
    );
    res.json({ flashcards: cards });
  } catch {
    res.status(500).json({ error: 'Failed to generate flashcards.' });
  }
});

// PATCH /api/flashcards/:id/review
router.patch('/:id/review', authMiddleware, async (req, res) => {
  const { quality } = req.body;
  try {
    const cards = await db.getFlashcards(req.user.id);
    const card = cards.find(c => c.id === req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    let ef = Math.max(1.3, card.ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    let interval = quality < 3 ? 1 : Math.round(card.interval === 1 ? 6 : card.interval * ef);
    const nextReview = new Date(Date.now() + interval * 86400000).toISOString();
    await db.updateFlashcard(card.id, { ease_factor: ef, interval, next_review: nextReview });
    await awardXP(req.user.id, 3);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/flashcards/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await db.deleteFlashcard(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
