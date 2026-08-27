const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const { AVATAR_COLORS } = require('../middleware/constants');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await db.getUserByUsername(username)) return res.status(400).json({ error: 'Username taken' });
    if (await db.getUserByEmail(email)) return res.status(400).json({ error: 'Email already registered' });

    const hash = bcrypt.hashSync(password, 10);
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const count = await db.countUsers();
    const isAdmin = count === 0;

    const user = await db.createUser({ username, email, password: hash, avatar_color: color, is_admin: isAdmin });
    const token = jwt.sign({ id: user.id, username, isAdmin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username, email, avatarColor: color, isAdmin, xp: 0, level: 1, streak: 0 } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', email);
    const user = await db.getUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let streak = user.streak || 0;
    if (user.last_active === yesterday) streak += 1;
    else if (user.last_active !== today) streak = 1;
    await db.updateUser(user.id, { last_active: today, streak });

    const token = jwt.sign(
      { id: user.id, username: user.username, isAdmin: user.is_admin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: {
        id: user.id, username: user.username, email: user.email,
        avatarColor: user.avatar_color, isAdmin: user.is_admin,
        xp: user.xp, level: user.level, streak,
      },
    });
  } catch (e) {
    console.error('Login error:', e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user.id, username: user.username, email: user.email,
      avatarColor: user.avatar_color, isAdmin: user.is_admin,
      xp: user.xp, level: user.level, streak: user.streak,
      displayName: user.display_name, school: user.school, grade: user.grade,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/auth/profile
router.patch('/profile', authMiddleware, async (req, res) => {
  try {
    const { displayName, school, grade, avatarColor } = req.body;
    const updates = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (school !== undefined) updates.school = school;
    if (grade !== undefined) updates.grade = grade;
    if (avatarColor !== undefined) updates.avatar_color = avatarColor;
    const user = await db.updateUser(req.user.id, updates);
    res.json({
      id: user.id, username: user.username, email: user.email,
      avatarColor: user.avatar_color, isAdmin: user.is_admin,
      xp: user.xp, level: user.level, streak: user.streak,
      displayName: user.display_name, school: user.school, grade: user.grade,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
