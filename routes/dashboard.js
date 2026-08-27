const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { BADGES } = require('../middleware/constants');

// GET /api/dashboard
router.get('/', authMiddleware, async (req, res) => {
  try {
    const uid = req.user.id;
    const [user, quizzes, sessions, badgeKeys, flashcardCount] = await Promise.all([
      db.getUserById(uid),
      db.getQuizAttempts(uid),
      db.getSessionsBySubject(uid),
      db.getBadges(uid),
      db.countFlashcards(uid),
    ]);
    const badges = badgeKeys.map(k => BADGES[k]).filter(Boolean);
    res.json({
      user: { xp: user.xp, level: user.level, streak: user.streak },
      quizzes, sessions, badges, flashcardCount, dueCards: 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
