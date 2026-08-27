const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const supabase = require('../middleware/supabase');

// GET /api/notes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('notes').select('*')
      .eq('user_id', req.user.id)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notes
router.post('/', authMiddleware, async (req, res) => {
  const { title, content, subject } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  try {
    const { data, error } = await supabase.from('notes').insert({
      user_id: req.user.id,
      title: title.trim(),
      content: content || '',
      subject: subject || 'General',
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/notes/:id
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('notes').update(updates)
      .eq('id', req.params.id).eq('user_id', req.user.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase.from('notes').delete()
      .eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
