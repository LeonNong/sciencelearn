const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const supabase = require('../middleware/supabase');

// GET /api/rooms
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('rooms').select(`
      *, users!owner_id(username),
      room_members!left(user_id)
    `).or(`is_public.eq.true,owner_id.eq.${req.user.id}`).order('created_at', { ascending: false });
    if (error) throw error;
    const roomIds = data.map(r => r.id);
    const counts = {};
    if (roomIds.length) {
      const { data: mc } = await supabase.from('room_members').select('room_id').in('room_id', roomIds);
      mc?.forEach(m => { counts[m.room_id] = (counts[m.room_id] || 0) + 1; });
    }
    res.json(data.map(r => ({ ...r, owner_name: r.users?.username, member_count: counts[r.id] || 0 })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/rooms
router.post('/', authMiddleware, async (req, res) => {
  const { name, description, isPublic } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Room name required' });
  try {
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = await db.createRoom({
      name: name.trim(), description: description || '',
      owner_id: req.user.id, is_public: !!isPublic, invite_code: inviteCode,
    });
    await db.addRoomMember(room.id, req.user.id);
    res.json(room);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/rooms/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: room } = await supabase.from('rooms').select('owner_id').eq('id', req.params.id).single();
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.owner_id !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Only the room owner or admin can delete this room' });
    }
    await supabase.from('rooms').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/rooms/join
router.post('/join', authMiddleware, async (req, res) => {
  try {
    const room = await db.getRoomByInviteCode(req.body.inviteCode?.toUpperCase());
    if (!room) return res.status(404).json({ error: 'Invalid invite code' });
    await db.addRoomMember(room.id, req.user.id);
    res.json(room);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/rooms/:id/messages
router.get('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const isAdmin = req.user.isAdmin;
    const messages = await db.getMessages(req.params.id);
    res.json(messages.map(m => ({
      id: m.id,
      content: m.content,
      is_anonymous: m.is_anonymous,
      created_at: Math.floor(new Date(m.created_at).getTime() / 1000),
      username: m.is_anonymous && !isAdmin ? 'Anonymous' : m.users?.username,
      avatar_color: m.is_anonymous && !isAdmin ? '#6B7280' : m.users?.avatar_color,
      user_id: m.is_anonymous && !isAdmin ? null : m.user_id,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/rooms/:id/members
router.get('/:id/members', authMiddleware, async (req, res) => {
  try {
    res.json(await db.getRoomMembers(req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
