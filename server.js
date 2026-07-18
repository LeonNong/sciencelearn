require('dotenv').config();

// Fallback: ensure env vars are set even if dotenv doesn't load on Render
process.env.SUPABASE_URL = process.env.SUPABASE_URL || '';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

console.log('ENV CHECK - SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'MISSING');
console.log('ENV CHECK - SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING');
console.log('ENV CHECK - JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'MISSING');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { callGemini } = require('./ai');

const app = express();
const server = http.createServer(app);
const JWT_SECRET = process.env.JWT_SECRET || 'sciencelearn-secret';
const CLIENT_ORIGINS = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(s => s.trim())
  : ['http://localhost:5175', 'http://localhost:5176', 'http://localhost:5173'];

const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (CLIENT_ORIGINS.some(o => origin === o || origin.endsWith('.vercel.app'))) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

const io = new Server(server, { cors: { origin: (origin, cb) => cb(null, true), methods: ['GET', 'POST'] } });
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

const AVATAR_COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4','#84CC16'];

const BADGES = {
  first_quiz:    { key: 'first_quiz',    name: 'Quiz Starter',   icon: '🧪', desc: 'Completed your first quiz' },
  streak_7:      { key: 'streak_7',      name: 'Week Warrior',   icon: '🔥', desc: '7-day study streak' },
  xp_100:        { key: 'xp_100',        name: 'Scholar',        icon: '📚', desc: 'Earned 100 XP' },
  xp_500:        { key: 'xp_500',        name: 'Science Ace',    icon: '🏆', desc: 'Earned 500 XP' },
  flashcard_10:  { key: 'flashcard_10',  name: 'Card Collector', icon: '🃏', desc: 'Created 10 flashcards' },
  perfect_score: { key: 'perfect_score', name: 'Perfect Score',  icon: '⭐', desc: 'Got 100% on a quiz' },
};

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

async function awardXP(userId, amount) {
  try {
    const user = await db.getUserById(userId);
    if (!user) return;
    const newXp = user.xp + amount;
    const newLevel = Math.floor(newXp / 100) + 1;
    await db.updateUser(userId, { xp: newXp, level: newLevel });
    await checkBadges(userId, newXp);
  } catch (e) { console.error('awardXP error:', e.message); }
}

async function checkBadges(userId, xp) {
  try {
    const existing = await db.getBadges(userId);
    const grant = async (key) => { if (!existing.includes(key)) await db.grantBadge(userId, key); };
    if (xp >= 100) await grant('xp_100');
    if (xp >= 500) await grant('xp_500');
    const cardCount = await db.countFlashcards(userId);
    if (cardCount >= 10) await grant('flashcard_10');
    const attempts = await db.getQuizAttempts(userId);
    if (attempts.length >= 1) await grant('first_quiz');
  } catch (e) { console.error('checkBadges error:', e.message); }
}

// ==================== AUTH ====================

app.post('/api/auth/register', async (req, res) => {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', email);
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'set' : 'MISSING');
    console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'set' : 'MISSING');
    const user = await db.getUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: 'Invalid email or password' });

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let streak = user.streak || 0;
    if (user.last_active === yesterday) streak += 1;
    else if (user.last_active !== today) streak = 1;
    await db.updateUser(user.id, { last_active: today, streak });

    const token = jwt.sign({ id: user.id, username: user.username, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatarColor: user.avatar_color, isAdmin: user.is_admin, xp: user.xp, level: user.level, streak } });
  } catch (e) { console.error('Login error:', e.message, e.stack); res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, username: user.username, email: user.email, avatarColor: user.avatar_color, isAdmin: user.is_admin, xp: user.xp, level: user.level, streak: user.streak });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== DASHBOARD ====================

app.get('/api/dashboard', authMiddleware, async (req, res) => {
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
    res.json({ user: { xp: user.xp, level: user.level, streak: user.streak }, quizzes, sessions, badges, flashcardCount, dueCards: 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== AI TUTOR ====================

app.post('/api/ai/tutor', authMiddleware, async (req, res) => {
  const { question, subject, difficulty = 'intermediate' } = req.body;
  if (!question) return res.status(400).json({ error: 'Question required' });
  const prompt = `You are an expert ${subject || 'Science'} tutor for high school students.
Answer this question at ${difficulty} level. Be clear, structured, and educational.
Include: main explanation, a real-world example, and one common misconception to avoid.
Question: ${question}`;
  const result = await callGemini(prompt);
  if (result.error) return res.status(503).json({ error: result.error });
  await awardXP(req.user.id, 5);
  res.json({ answer: result.text });
});

// ==================== QUIZ ====================

app.post('/api/ai/quiz/generate', authMiddleware, async (req, res) => {
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
  } catch { res.status(500).json({ error: 'Failed to parse quiz. Try again.' }); }
});

app.post('/api/ai/quiz/check', authMiddleware, async (req, res) => {
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
      } catch { feedback = `Expected: ${q.answer}`; }
    }
    results.push({ id: q.id, correct, feedback, userAnswer, correctAnswer: q.answer });
  }
  const finalScore = Math.round(score);
  await db.createQuizAttempt({ user_id: req.user.id, subject, topic, score: finalScore, total: questions.length });
  await awardXP(req.user.id, finalScore * 10);
  res.json({ score: finalScore, total: questions.length, xpEarned: finalScore * 10, results });
});

// ==================== FLASHCARDS ====================

app.get('/api/flashcards', authMiddleware, async (req, res) => {
  try { res.json(await db.getFlashcards(req.user.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/flashcards', authMiddleware, async (req, res) => {
  const { subject, question, answer } = req.body;
  if (!subject || !question || !answer) return res.status(400).json({ error: 'All fields required' });
  try {
    const card = await db.createFlashcard({ user_id: req.user.id, subject, question, answer });
    await awardXP(req.user.id, 2);
    res.json(card);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/flashcards/generate', authMiddleware, async (req, res) => {
  const { subject, topic, count = 5 } = req.body;
  const prompt = `Generate ${count} flashcards for "${topic}" in ${subject} for high school students.
Return ONLY valid JSON: { "flashcards": [{ "question": "...", "answer": "..." }] }`;
  const result = await callGemini(prompt);
  if (result.error) return res.status(503).json({ error: result.error });
  try {
    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)[0]);
    const cards = await Promise.all(parsed.flashcards.map(c =>
      db.createFlashcard({ user_id: req.user.id, subject, question: c.question, answer: c.answer })
    ));
    res.json({ flashcards: cards });
  } catch { res.status(500).json({ error: 'Failed to generate flashcards.' }); }
});

app.patch('/api/flashcards/:id/review', authMiddleware, async (req, res) => {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/flashcards/:id', authMiddleware, async (req, res) => {
  try { await db.deleteFlashcard(req.params.id, req.user.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== STUDY PLANNER ====================

app.post('/api/planner/generate', authMiddleware, async (req, res) => {
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
    const plan = await db.createStudyPlan({ user_id: req.user.id, exam_date: examDate, subject, plan_json: JSON.stringify(parsed) });
    res.json({ id: plan.id, ...parsed });
  } catch { res.status(500).json({ error: 'Failed to generate plan.' }); }
});

app.get('/api/planner', authMiddleware, async (req, res) => {
  try {
    const plans = await db.getStudyPlans(req.user.id);
    res.json(plans.map(p => ({ ...p, plan_json: JSON.parse(p.plan_json) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== STUDY SESSIONS ====================

app.post('/api/sessions', authMiddleware, async (req, res) => {
  const { subject, durationMinutes } = req.body;
  if (!subject || !durationMinutes) return res.status(400).json({ error: 'Subject and duration required' });
  try {
    await db.createSession({ user_id: req.user.id, subject, duration_minutes: durationMinutes });
    await awardXP(req.user.id, Math.floor(durationMinutes / 10));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== CHAT ROOMS ====================

app.get('/api/rooms', authMiddleware, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('rooms').select(`
      *, users!owner_id(username),
      room_members!left(user_id)
    `).or(`is_public.eq.true,owner_id.eq.${req.user.id}`).order('created_at', { ascending: false });
    if (error) throw error;
    // Add member count
    const roomIds = data.map(r => r.id);
    const counts = {};
    if (roomIds.length) {
      const { data: mc } = await supabase.from('room_members').select('room_id').in('room_id', roomIds);
      mc?.forEach(m => { counts[m.room_id] = (counts[m.room_id] || 0) + 1; });
    }
    res.json(data.map(r => ({ ...r, owner_name: r.users?.username, member_count: counts[r.id] || 0 })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rooms', authMiddleware, async (req, res) => {
  const { name, description, isPublic } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Room name required' });
  try {
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = await db.createRoom({ name: name.trim(), description: description || '', owner_id: req.user.id, is_public: !!isPublic, invite_code: inviteCode });
    await db.addRoomMember(room.id, req.user.id);
    res.json(room);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rooms/join', authMiddleware, async (req, res) => {
  try {
    const room = await db.getRoomByInviteCode(req.body.inviteCode?.toUpperCase());
    if (!room) return res.status(404).json({ error: 'Invalid invite code' });
    await db.addRoomMember(room.id, req.user.id);
    res.json(room);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/rooms/:id/messages', authMiddleware, async (req, res) => {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/rooms/:id/members', authMiddleware, async (req, res) => {
  try { res.json(await db.getRoomMembers(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== SOCKET.IO ====================

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

io.use((socket, next) => {
  const user = verifyToken(socket.handshake.auth.token);
  if (!user) return next(new Error('Unauthorized'));
  socket.user = user;
  next();
});

io.on('connection', (socket) => {
  socket.on('join_room', roomId => { socket.join(roomId); });
  socket.on('leave_room', roomId => socket.leave(roomId));

  socket.on('send_message', async ({ roomId, content, isAnonymous }) => {
    if (!content?.trim()) return;
    try {
      const msg = await db.createMessage({ room_id: roomId, user_id: socket.user.id, content: content.trim(), is_anonymous: !!isAnonymous });
      const user = await db.getUserById(socket.user.id);
      const created_at = Math.floor(new Date(msg.created_at).getTime() / 1000);

      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        for (const sid of roomSockets) {
          const ts = io.sockets.sockets.get(sid);
          if (!ts) continue;
          const showReal = !isAnonymous || ts.user.isAdmin || ts.user.id === socket.user.id;
          ts.emit('new_message', {
            id: msg.id, room_id: roomId, content: content.trim(),
            is_anonymous: isAnonymous ? 1 : 0, created_at,
            username: showReal ? user.username : 'Anonymous',
            avatar_color: showReal ? user.avatar_color : '#6B7280',
            user_id: showReal ? socket.user.id : null,
            is_mine: ts.user.id === socket.user.id
          });
        }
      }
      await awardXP(socket.user.id, 1);
    } catch (e) { console.error('send_message error:', e.message); }
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => console.log(`ScienceLearn server at http://localhost:${PORT}`));
