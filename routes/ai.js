const express = require('express');
const router = express.Router();
const { callGemini } = require('../ai');
const { authMiddleware } = require('../middleware/auth');
const { awardXP } = require('../lib/xp');
const db = require('../db');

// ── AI Rate Limiting ───────────────────────────────────────────────────────
const aiUsage = {};
const AI_LIMITS = { tutor: 20, quiz_generate: 5, flashcard_generate: 10, planner: 3 };

function getToday() { return new Date().toISOString().slice(0, 10); }

function checkAiLimit(action) {
  return (req, res, next) => {
    if (req.user.isAdmin) {
      res.setHeader('X-AI-Used', 0);
      res.setHeader('X-AI-Limit', 'unlimited');
      res.setHeader('X-AI-Remaining', 'unlimited');
      return next();
    }
    const key = `${req.user.id}_${action}_${getToday()}`;
    const used = aiUsage[key] || 0;
    const limit = AI_LIMITS[action];
    if (used >= limit) {
      return res.status(429).json({
        error: `Daily limit reached. You can use ${action.replace('_', ' ')} ${limit} times per day. Resets at midnight.`,
        used, limit, remaining: 0,
      });
    }
    aiUsage[key] = used + 1;
    res.setHeader('X-AI-Used', aiUsage[key]);
    res.setHeader('X-AI-Limit', limit);
    res.setHeader('X-AI-Remaining', limit - aiUsage[key]);
    next();
  };
}

// GET /api/ai/usage
router.get('/usage', authMiddleware, (req, res) => {
  if (req.user.isAdmin) {
    const usage = {};
    for (const action of Object.keys(AI_LIMITS)) {
      usage[action] = { used: 0, limit: 'unlimited', remaining: 'unlimited' };
    }
    return res.json(usage);
  }
  const today = getToday();
  const usage = {};
  for (const [action, limit] of Object.entries(AI_LIMITS)) {
    const used = aiUsage[`${req.user.id}_${action}_${today}`] || 0;
    usage[action] = { used, limit, remaining: limit - used };
  }
  res.json(usage);
});

// POST /api/ai/tutor
router.post('/tutor', authMiddleware, checkAiLimit('tutor'), async (req, res) => {
  const { question, subject, difficulty = 'intermediate' } = req.body;
  if (!question) return res.status(400).json({ error: 'Question required' });
  const prompt = `You are a friendly and encouraging ${subject || 'Science'} tutor for high school students.
Answer at ${difficulty} level. Use this exact structure:

## 📌 Main Explanation
[2-3 clear paragraphs explaining the concept simply]

## 💡 Key Points
- [point 1]
- [point 2]
- [point 3]

## 🌍 Real-World Example
[One relatable everyday example]

## ⚠️ Common Mistake to Avoid
[One thing students often get wrong]

Be warm, encouraging and clear. Use simple language. End with a motivating sentence.
Question: ${question}`;
  const result = await callGemini(prompt);
  if (result.error) return res.status(503).json({ error: result.error });
  await awardXP(req.user.id, 5);
  res.json({ answer: result.text });
});

// POST /api/ai/quiz/generate
router.post('/quiz/generate', authMiddleware, checkAiLimit('quiz_generate'), async (req, res) => {
  const { subject, topic, difficulty = 'medium', count = 5, type = 'mixed' } = req.body;
  if (!subject || !topic) return res.status(400).json({ error: 'Subject and topic required' });
  const prompt = `Generate ${count} ${difficulty} difficulty ${type === 'mixed' ? 'mixed (MCQ and short answer)' : type} questions about "${topic}" in ${subject} for high school students.
Return ONLY valid JSON:
{
  "questions": [
    { "id": 1, "type": "mcq", "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A", "explanation": "..." },
    { "id": 2, "type": "short", "question": "...", "answer": "...", "keywords": ["kw1"], "explanation": "..." }
  ]
}`;
  const result = await callGemini(prompt);
  if (result.error) return res.status(503).json({ error: result.error });
  try {
    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)[0]);
    res.json(parsed);
  } catch {
    res.status(500).json({ error: 'Failed to parse quiz. Try again.' });
  }
});

// POST /api/ai/quiz/check
router.post('/quiz/check', authMiddleware, async (req, res) => {
  const { subject, topic, questions, answers } = req.body;
  let score = 0;
  const results = [];
  for (const q of questions) {
    const userAnswer = answers[q.id] || '';
    let correct = false, feedback = '';
    if (q.type === 'mcq') {
      correct = userAnswer.trim().toUpperCase() === q.answer.toUpperCase();
      feedback = correct ? 'Correct!' : `Incorrect. The answer is ${q.answer}. ${q.explanation}`;
      if (correct) score += 1;
    } else {
      const prompt = `Mark this short answer for a high school ${subject} question.
Question: ${q.question}
Expected answer: ${q.answer}
Keywords: ${(q.keywords || []).join(', ')}
Student answer: ${userAnswer}
Reply with JSON only: { "correct": true/false, "score": 0-1, "feedback": "..." }`;
      const aiResult = await callGemini(prompt);
      try {
        const parsed = JSON.parse(aiResult.text?.match(/\{[\s\S]*\}/)[0]);
        correct = parsed.correct;
        feedback = parsed.feedback;
        score += parsed.score || 0;
      } catch {
        feedback = `Expected: ${q.answer}`;
      }
    }
    results.push({ id: q.id, correct, feedback, userAnswer, correctAnswer: q.answer });
  }
  const finalScore = Math.round(score);
  await db.createQuizAttempt({ user_id: req.user.id, subject, topic, score: finalScore, total: questions.length });
  await awardXP(req.user.id, finalScore * 10);
  res.json({ score: finalScore, total: questions.length, xpEarned: finalScore * 10, results });
});

// Export router as default AND expose checkAiLimit for other route modules
module.exports = router;
module.exports.checkAiLimit = checkAiLimit;
