const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const supabase = require('../middleware/supabase');

// GET /api/leaderboard
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, avatar_color, xp, level, streak, school, grade')
      .order('xp', { ascending: false })
      .limit(50);
    if (error) throw error;
    const ranked = data.map((u, i) => ({
      rank: i + 1,
      id: u.id,
      username: u.username,
      displayName: u.display_name || u.username,
      avatarColor: u.avatar_color,
      xp: u.xp,
      level: u.level,
      streak: u.streak,
      school: u.school,
      description: u.grade,
      isMe: u.id === req.user.id,
    }));
    res.json(ranked);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
