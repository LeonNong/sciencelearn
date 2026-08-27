const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const supabase = require('../middleware/supabase');

// POST /api/feedback
router.post('/', authMiddleware, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Feedback text required' });
  try {
    const { error } = await supabase.from('feedback').insert({
      user_id: req.user.id,
      username: req.user.username,
      text: text.trim(),
    });
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
