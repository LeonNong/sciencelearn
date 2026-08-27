const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { awardXP } = require('../lib/xp');

// POST /api/sessions
router.post('/', authMiddleware, async (req, res) => {
  const { subject, durationMinutes } = req.body;
  if (!subject || !durationMinutes) return res.status(400).json({ error: 'Subject and duration required' });
  try {
    await db.createSession({ user_id: req.user.id, subject, duration_minutes: durationMinutes });
    await awardXP(req.user.id, Math.floor(durationMinutes / 10));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
