const express = require('express');
const router = express.Router();
const db = require('../db');
const { callGemini } = require('../ai');
const { authMiddleware } = require('../middleware/auth');
const { awardXP } = require('../lib/xp');
const { checkAiLimit } = require('./ai');

// POST /api/planner/generate
router.post('/generate', authMiddleware, checkAiLimit('planner'), async (req, res) => {
  const { subject, examDate, hoursPerDay = 2, weakTopics } = req.body;
  if (!subject || !examDate) return res.status(400).json({ error: 'Subject and exam date required' });
  const daysLeft = Math.ceil((new Date(examDate) - new Date()) / 86400000);
  if (daysLeft < 1) return res.status(400).json({ error: 'Exam date must be in the future' });
  const prompt = `Create a ${daysLeft}-day study plan for a high school student studying ${subject}.
Exam date: ${examDate}. Available: ${hoursPerDay} hours/day. ${weakTopics ? `Weak topics: ${weakTopics}` : ''}
Return ONLY valid JSON:
{ "plan": [{ "day": 1, "date": "YYYY-MM-DD", "topic": "...", "tasks": ["task1"], "hours": 2 }], "tips": ["tip1"] }`;
  const result = await callGemini(prompt);
  if (result.error) return res.status(503).json({ error: result.error });
  try {
    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)[0]);
    const plan = await db.createStudyPlan({
      user_id: req.user.id, exam_date: examDate, subject, plan_json: JSON.stringify(parsed),
    });
    res.json({ id: plan.id, ...parsed });
  } catch {
    res.status(500).json({ error: 'Failed to generate plan.' });
  }
});

// GET /api/planner
router.get('/', authMiddleware, async (req, res) => {
  try {
    const plans = await db.getStudyPlans(req.user.id);
    res.json(plans.map(p => ({ ...p, plan_json: JSON.parse(p.plan_json) })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
