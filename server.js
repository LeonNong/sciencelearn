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
const { callGemini, callGeminiVision } = require('./ai');

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

// ==================== AI RATE LIMITING ====================
// In-memory store: { userId_action_date: count }
const aiUsage = {};
const AI_LIMITS = { tutor: 20, quiz_generate: 5, flashcard_generate: 10, planner: 3 };

function getToday() { return new Date().toISOString().slice(0, 10); }

function checkAiLimit(action) {
  return (req, res, next) => {
    // Admin users have no limits
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

app.get('/api/ai/usage', authMiddleware, (req, res) => {
  // Admin users have unlimited usage
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
    res.json({ id: user.id, username: user.username, email: user.email, avatarColor: user.avatar_color, isAdmin: user.is_admin, xp: user.xp, level: user.level, streak: user.streak, displayName: user.display_name, school: user.school, grade: user.grade });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const { displayName, school, grade, avatarColor } = req.body;
    const updates = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (school !== undefined) updates.school = school;
    if (grade !== undefined) updates.grade = grade;
    if (avatarColor !== undefined) updates.avatar_color = avatarColor;
    const user = await db.updateUser(req.user.id, updates);
    res.json({ id: user.id, username: user.username, email: user.email, avatarColor: user.avatar_color, isAdmin: user.is_admin, xp: user.xp, level: user.level, streak: user.streak, displayName: user.display_name, school: user.school, grade: user.grade });
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

app.post('/api/ai/tutor', authMiddleware, checkAiLimit('tutor'), async (req, res) => {
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

// ==================== QUIZ ====================

app.post('/api/ai/quiz/generate', authMiddleware, checkAiLimit('quiz_generate'), async (req, res) => {
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

app.post('/api/flashcards/generate', authMiddleware, checkAiLimit('flashcard_generate'), async (req, res) => {
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

app.post('/api/planner/generate', authMiddleware, checkAiLimit('planner'), async (req, res) => {
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

// ==================== LARE ====================

// LARE Algorithm: calculates priority score for a topic
function calcLarePriority(topic) {
  const today = new Date();

  // U: Exam Urgency
  const daysUntilExam = Math.ceil((new Date(topic.exam_date) - today) / 86400000);
  let U = 20;
  if (daysUntilExam <= 5)       U = 100;
  else if (daysUntilExam <= 10) U = 80;
  else if (daysUntilExam <= 20) U = 60;
  else if (daysUntilExam <= 30) U = 40;

  // D: Difficulty Rating (1-5 → 20-100)
  const D = topic.difficulty * 20;

  // E: Error Rate from quiz performance
  const E = topic.quiz_total > 0
    ? (1 - topic.quiz_correct / topic.quiz_total) * 100
    : 50; // default 50% if no quiz taken

  // R: Revision Gap
  let R = 100;
  if (topic.last_revised_at) {
    const daysSince = Math.floor((today - new Date(topic.last_revised_at)) / 86400000);
    if (daysSince <= 1)      R = 10;
    else if (daysSince <= 3) R = 40;
    else if (daysSince <= 7) R = 70;
  }

  const score = 0.35 * U + 0.30 * D + 0.20 * E + 0.15 * R;
  return { score: Math.round(score), U, D, E, R, daysUntilExam };
}

app.get('/api/lare', authMiddleware, async (req, res) => {
  try {
    const topics = await db.getLareTopics(req.user.id);
    const ranked = topics.map(t => ({
      ...t,
      ...calcLarePriority(t),
    })).sort((a, b) => b.score - a.score);
    res.json(ranked);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/lare', authMiddleware, async (req, res) => {
  const { subject, topic, examDate, difficulty } = req.body;
  if (!subject || !topic || !examDate) return res.status(400).json({ error: 'subject, topic, and examDate required' });
  try {
    const t = await db.createLareTopic({
      user_id: req.user.id, subject, topic,
      exam_date: examDate, difficulty: difficulty || 3,
    });
    res.json({ ...t, ...calcLarePriority(t) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/lare/:id', authMiddleware, async (req, res) => {
  try {
    const t = await db.updateLareTopic(req.params.id, req.user.id, req.body);
    res.json({ ...t, ...calcLarePriority(t) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/lare/:id', authMiddleware, async (req, res) => {
  try {
    await db.deleteLareTopic(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Generate AI content for LARE top topic
app.post('/api/lare/:id/generate', authMiddleware, checkAiLimit('tutor'), async (req, res) => {
  try {
    const topics = await db.getLareTopics(req.user.id);
    const topic = topics.find(t => t.id === req.params.id);
    if (!topic) return res.status(404).json({ error: 'Topic not found' });

    const quizPct = topic.quiz_total > 0 ? Math.round((topic.quiz_correct / topic.quiz_total) * 100) : null;
    const diffLabel = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'][topic.difficulty];

    const prompt = `You are an expert ${topic.subject} tutor for a high school student.

Topic: ${topic.topic}
Subject: ${topic.subject}
Difficulty rating: ${diffLabel} (${topic.difficulty}/5)
${quizPct !== null ? `Previous quiz score: ${quizPct}%` : 'No quiz taken yet'}

Generate personalised learning content in the following JSON format ONLY:
{
  "explanation": "Clear 3-4 paragraph explanation with real-world examples",
  "revision_notes": ["key point 1", "key point 2", "key point 3", "key point 4", "key point 5"],
  "common_mistakes": ["mistake 1", "mistake 2", "mistake 3"],
  "quiz": [
    { "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A", "explanation": "..." },
    { "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "B", "explanation": "..." },
    { "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "C", "explanation": "..." },
    { "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A", "explanation": "..." },
    { "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "D", "explanation": "..." }
  ],
  "flashcards": [
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
  ]
}`;

    const result = await callGemini(prompt);
    if (result.error) return res.status(503).json({ error: result.error });

    try {
      const content = JSON.parse(result.text.match(/\{[\s\S]*\}/)[0]);

      // Update last_revised_at
      await db.updateLareTopic(topic.id, req.user.id, {
        last_revised_at: new Date().toISOString(),
        revision_count: (topic.revision_count || 0) + 1,
      });

      await awardXP(req.user.id, 10);
      res.json(content);
    } catch {
      res.status(500).json({ error: 'Failed to parse AI content. Try again.' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Record quiz result for a LARE topic
app.post('/api/lare/:id/quiz-result', authMiddleware, async (req, res) => {
  try {
    const { correct, total } = req.body;
    const topics = await db.getLareTopics(req.user.id);
    const topic = topics.find(t => t.id === req.params.id);
    if (!topic) return res.status(404).json({ error: 'Topic not found' });

    const newCorrect = topic.quiz_correct + correct;
    const newTotal = topic.quiz_total + total;
    const updated = await db.updateLareTopic(topic.id, req.user.id, {
      quiz_correct: newCorrect,
      quiz_total: newTotal,
      last_revised_at: new Date().toISOString(),
    });
    await awardXP(req.user.id, correct * 10);
    res.json({ ...updated, ...calcLarePriority(updated) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== EXAM GRADES ====================

// Scan a grade report image and extract grades with AI
app.post('/api/grades/scan', authMiddleware, async (req, res) => {
  const { image, mimeType } = req.body;
  if (!image) return res.status(400).json({ error: 'Image required' });

  const prompt = `You are analysing a student's grade/mark report image.
Extract ALL assessments you can see (classwork, tests, exams, projects, etc.).
For each one return a JSON array. Use today's date if no date is visible.
Subject names should match one of: Biology, Chemistry, Physics, Mathematics, Mathematical Literacy, English, English HL, Afrikaans, Afrikaans FAL, isiZulu, Life Orientation — or use the exact name shown if it doesn't match.

Return ONLY valid JSON — no markdown, no explanation:
[
  { "subject": "Mathematics", "label": "Term 1 Test", "score": 72, "date": "2025-03-15", "comment": "Good effort, needs to revise algebra." },
  ...
]

Rules:
- score must be a number 0-100 (convert fractions like 13/20 to percentage: 65)
- date must be YYYY-MM-DD format
- label should be the assessment name as shown
- comment should be the teacher's remark or comment for that subject/assessment if visible; use null if none
- If you cannot read the score clearly, skip that item`;

  const result = await callGeminiVision(prompt, image, mimeType || 'image/jpeg');
  if (result.error) return res.status(503).json({ error: result.error });

  try {
    let text = result.text || '';
    // Strip markdown code fences if present
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error('Grade scan raw response:', text.slice(0, 500));
      return res.status(422).json({ error: 'Could not extract grades from image. Try a clearer photo.' });
    }
    const grades = JSON.parse(match[0]);
    // Wrap single object in array just in case
    res.json({ grades: Array.isArray(grades) ? grades : [grades] });
  } catch (e) {
    console.error('Grade scan parse error:', e.message, result.text?.slice(0, 500));
    res.status(422).json({ error: 'Could not parse grades from image. Try a clearer photo.' });
  }
});

// Scan image/PDF and extract teacher comments per subject
app.post('/api/grades/scan-comments', authMiddleware, async (req, res) => {
  const { image, mimeType } = req.body;
  if (!image) return res.status(400).json({ error: 'Image required' });

  const prompt = `You are analysing a student's report card image.
Extract ALL teacher comments, remarks, or feedback visible for each subject.
Return ONLY valid JSON — no markdown, no explanation:
[
  { "subject": "Mathematics", "comment": "Good progress but needs to work on algebra.", "date": "2025-03-15" },
  ...
]

Rules:
- subject should match one of: Biology, Chemistry, Physics, Mathematics, Mathematical Literacy, English, English HL, Afrikaans, Afrikaans FAL, isiZulu, Life Orientation — or use the exact name shown
- comment must be the exact teacher remark/comment text as written on the report card
- date should be the report card date in YYYY-MM-DD format; use today if not visible
- Only include subjects that actually have a visible comment
- If no comments are found at all, return an empty array []`;

  const result = await callGeminiVision(prompt, image, mimeType || 'image/jpeg');
  if (result.error) return res.status(503).json({ error: result.error });

  try {
    let text = result.text || '';
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error('Scan-comments raw response:', text.slice(0, 500));
      return res.json({ comments: [] });
    }
    const comments = JSON.parse(match[0]);
    res.json({ comments: Array.isArray(comments) ? comments : [comments] });
  } catch (e) {
    console.error('Scan-comments parse error:', e.message);
    res.json({ comments: [] });
  }
});

app.get('/api/grades', authMiddleware, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('exam_grades').select('*')
      .eq('user_id', req.user.id).order('date', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/grades', authMiddleware, async (req, res) => {
  const { subject, label, score, date, comment } = req.body;
  if (!subject || !label || score === undefined || !date) return res.status(400).json({ error: 'All fields required' });
  if (score < 0 || score > 100) return res.status(400).json({ error: 'Score must be 0-100' });
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('exam_grades').insert({
      user_id: req.user.id, subject, label, score: Number(score), date, comment: comment || null
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/grades/:id', authMiddleware, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { error } = await supabase.from('exam_grades').delete()
      .eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== NOTES ====================

app.get('/api/notes', authMiddleware, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('notes').select('*')
      .eq('user_id', req.user.id).order('pinned', { ascending: false }).order('updated_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notes', authMiddleware, async (req, res) => {
  const { title, content, subject } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('notes').insert({
      user_id: req.user.id, title: title.trim(), content: content || '', subject: subject || 'General'
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/notes/:id', authMiddleware, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('notes').update(updates)
      .eq('id', req.params.id).eq('user_id', req.user.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/notes/:id', authMiddleware, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { error } = await supabase.from('notes').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== LANGUAGE LEARNING ====================

function supabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

// GET vocab words for user
app.get('/api/lang/vocab', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase().from('lang_vocab').select('*')
      .eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AI generate vocab entry
app.post('/api/lang/vocab/generate', authMiddleware, async (req, res) => {
  const { word, language } = req.body;
  if (!word) return res.status(400).json({ error: 'Word required' });
  const isAfrikaans = (language || '').toLowerCase() === 'afrikaans';
  const prompt = `For the ${language || 'English'} word "${word}", return ONLY valid JSON (no markdown):
{
  "word": "${word}",
  "language": "${language || 'English'}",
  "meanings": [
    {
      "part_of_speech": "noun/verb/adjective/adverb/etc${isAfrikaans ? ' (for Afrikaans verbs use: verb (v1) for infinitive form, verb (v2) for conjugated form)' : ''}",
      "pos_abbr": "n./v./adj./adv./v1./v2./prep./conj./etc${isAfrikaans ? ' — for Afrikaans verbs also add tense: Past/Future/Present after the abbr e.g. v2. Past' : ''}",
      "definition": "clear concise definition for this meaning",
      "example": "natural example sentence using the word in this meaning"
    }
  ],
  "translation": "translation to English (if not already English, else leave blank)"
}
Include ALL common meanings. For Afrikaans verbs, always include both v1 (infinitive e.g. loop) and v2 (conjugated e.g. geloop) as separate meanings if applicable. For past tense forms (prefix ge-) mark as Past, for future tense (sal + verb) mark as Future.`;
  const result = await callGemini(prompt);
  if (result.error) return res.status(503).json({ error: result.error });
  try {
    let text = result.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const entry = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
    // Flatten for DB: store first meaning in legacy fields, store all meanings as JSON
    const firstMeaning = entry.meanings?.[0] || {}
    const { data, error } = await supabase().from('lang_vocab').insert({
      user_id: req.user.id,
      word: entry.word,
      language: entry.language,
      part_of_speech: firstMeaning.part_of_speech || '',
      definition: JSON.stringify(entry.meanings || []),  // store all meanings as JSON
      example: firstMeaning.example || '',
      translation: entry.translation || '',
      ease_factor: 2.5, interval: 1,
      next_review: new Date().toISOString(),
      correct: 0, incorrect: 0,
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: 'Failed to generate vocab: ' + e.message }); }
});

// Verify/refresh a vocab entry — re-generate with AI
app.post('/api/lang/vocab/:id/refresh', authMiddleware, async (req, res) => {
  try {
    const { data: card } = await supabase().from('lang_vocab').select('*').eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (!card) return res.status(404).json({ error: 'Word not found' });
    const isAfrikaans = (card.language || '').toLowerCase() === 'afrikaans';
    const prompt = `For the ${card.language} word "${card.word}", return ONLY valid JSON (no markdown):
{
  "word": "${card.word}",
  "language": "${card.language}",
  "meanings": [
    {
      "part_of_speech": "noun/verb/adjective/etc${isAfrikaans ? ' (use verb (v1) for infinitive, verb (v2) for conjugated)' : ''}",
      "pos_abbr": "n./v./adj./adv./v1./v2./prep./conj./etc${isAfrikaans ? ' — add tense after abbr: Past/Future/Present e.g. v2. Past' : ''}",
      "definition": "clear concise definition",
      "example": "natural example sentence"
    }
  ],
  "translation": "English translation or blank"
}
Include ALL common meanings. For Afrikaans verbs include both v1 and v2 if applicable. For past tense forms (ge- prefix) mark as Past, future (sal +) mark as Future.`;
    const result = await callGemini(prompt);
    if (result.error) return res.status(503).json({ error: result.error });
    let text = result.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const entry = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
    const firstMeaning = entry.meanings?.[0] || {};
    const { data, error } = await supabase().from('lang_vocab').update({
      part_of_speech: firstMeaning.part_of_speech || '',
      definition: JSON.stringify(entry.meanings || []),
      example: firstMeaning.example || '',
      translation: entry.translation || '',
    }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: 'Failed to refresh: ' + e.message }); }
});

// Save vocab review result (spaced repetition)
app.patch('/api/lang/vocab/:id/review', authMiddleware, async (req, res) => {
  const { quality } = req.body; // 0=wrong, 3=hard, 4=good, 5=easy
  try {
    const { data: card } = await supabase().from('lang_vocab').select('*').eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (!card) return res.status(404).json({ error: 'Word not found' });
    let ef = Math.max(1.3, card.ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    let interval = quality < 3 ? 1 : Math.round(card.interval === 1 ? 6 : card.interval * ef);
    const nextReview = new Date(Date.now() + interval * 86400000).toISOString();
    const correct = quality >= 3 ? card.correct + 1 : card.correct;
    const incorrect = quality < 3 ? card.incorrect + 1 : card.incorrect;
    const { data, error } = await supabase().from('lang_vocab').update({ ease_factor: ef, interval, next_review: nextReview, correct, incorrect }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/lang/vocab/:id', authMiddleware, async (req, res) => {
  try {
    await supabase().from('lang_vocab').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AI generate adaptive quiz
app.post('/api/lang/quiz', authMiddleware, async (req, res) => {
  const { language, level = 'intermediate', weakWords = [] } = req.body;
  const weakHint = weakWords.length ? `Focus on these words the student struggled with: ${weakWords.slice(0, 5).join(', ')}.` : '';
  const prompt = `Generate 5 ${level} ${language || 'English'} language quiz questions. ${weakHint}
Mix these types: multiple choice vocabulary, fill-in-the-blank, choose correct grammar form.
Return ONLY valid JSON:
{ "questions": [
  { "id": 1, "type": "mcq", "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A", "explanation": "..." },
  { "id": 2, "type": "fill", "question": "Fill in: ___ is the capital of France.", "answer": "Paris", "explanation": "..." }
] }`;
  const result = await callGemini(prompt);
  if (result.error) return res.status(503).json({ error: result.error });
  try {
    let text = result.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    res.json(JSON.parse(text.match(/\{[\s\S]*\}/)[0]));
  } catch { res.status(500).json({ error: 'Failed to generate quiz.' }); }
});

// AI grammar practice
app.post('/api/lang/grammar', authMiddleware, async (req, res) => {
  const { language, type = 'mixed' } = req.body; // type: mcq | fill | correct
  const prompt = `Generate 5 ${language || 'English'} grammar exercises of type: ${type}.
- mcq: multiple choice grammar question
- fill: fill in the blank with correct form
- correct: find and fix the error in the sentence
Return ONLY valid JSON:
{ "exercises": [
  { "id": 1, "type": "mcq", "instruction": "Choose the correct form:", "sentence": "She ___ to school every day.", "options": ["A) go", "B) goes", "C) going", "D) gone"], "answer": "B", "explanation": "Third person singular uses 'goes'." },
  { "id": 2, "type": "correct", "instruction": "Find and fix the error:", "sentence": "He don't like coffee.", "answer": "He doesn't like coffee.", "explanation": "Use 'doesn't' for third person singular." }
] }`;
  const result = await callGemini(prompt);
  if (result.error) return res.status(503).json({ error: result.error });
  try {
    let text = result.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    res.json(JSON.parse(text.match(/\{[\s\S]*\}/)[0]));
  } catch { res.status(500).json({ error: 'Failed to generate grammar exercises.' }); }
});

// AI writing analysis — detect AI content, translate native language words
app.post('/api/lang/writing', authMiddleware, async (req, res) => {
  const { language, nativeLanguage = 'Chinese', prompt: userPrompt, text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });
  const aiPrompt = `You are a ${language} language teacher analysing a student's writing.
The student was asked to write in ${language} but may have mixed in ${nativeLanguage} words for words they don't know.
${userPrompt ? `Topic: "${userPrompt}"` : 'Free writing (no specific topic given).'}

Student's writing:
"${text}"

Task:
1. Detect if this text looks AI-generated (too formal, perfect grammar, no personal voice, overly structured)
2. Find every word/phrase written in ${nativeLanguage} (or any non-${language} language)
3. For each native-language word found, provide the ${language} translation
4. Write all feedback, strengths, and suggestions in ${nativeLanguage}

Return ONLY valid JSON:
{
  "ai_score": 0-100,
  "ai_warning": "brief explanation in ${nativeLanguage} if score > 60, else null",
  "native_words": [
    { "original": "the native word as written", "translation": "${language} equivalent", "definition": "brief meaning in ${nativeLanguage}", "example": "example sentence in ${language}" }
  ],
  "feedback": "2-3 sentences of encouraging feedback in ${nativeLanguage}",
  "strengths": ["strength in ${nativeLanguage}"],
  "suggestions": ["suggestion in ${nativeLanguage}"]
}`;

  const result = await callGemini(aiPrompt);
  if (result.error) return res.status(503).json({ error: result.error });
  try {
    let t = result.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    res.json(JSON.parse(t.match(/\{[\s\S]*\}/)[0]));
  } catch { res.status(500).json({ error: 'Failed to analyse writing.' }); }
});

// GET language progress stats
app.get('/api/lang/progress', authMiddleware, async (req, res) => {
  try {
    const { data: vocab } = await supabase().from('lang_vocab').select('*').eq('user_id', req.user.id);
    const total = vocab?.length || 0;
    const mastered = vocab?.filter(v => v.correct >= 3 && v.incorrect === 0).length || 0;
    const learning = vocab?.filter(v => v.correct > 0 || v.incorrect > 0).length || 0;
    const dueNow = vocab?.filter(v => new Date(v.next_review) <= new Date()).length || 0;
    const totalCorrect = vocab?.reduce((a, v) => a + v.correct, 0) || 0;
    const totalIncorrect = vocab?.reduce((a, v) => a + v.incorrect, 0) || 0;
    res.json({ total, mastered, learning, dueNow, totalCorrect, totalIncorrect });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== FEEDBACK ====================

app.post('/api/feedback', authMiddleware, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Feedback text required' });
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { error } = await supabase.from('feedback').insert({
      user_id: req.user.id,
      username: req.user.username,
      text: text.trim(),
    });
    if (error) throw error;
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

app.delete('/api/rooms/:id', authMiddleware, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: room } = await supabase.from('rooms').select('owner_id').eq('id', req.params.id).single();
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.owner_id !== req.user.id && !req.user.isAdmin) return res.status(403).json({ error: 'Only the room owner or admin can delete this room' });
    await supabase.from('rooms').delete().eq('id', req.params.id);
    res.json({ success: true });
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

app.get('/api/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));

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
server.listen(PORT, () => {
  console.log(`LearnWay server at http://localhost:${PORT}`)

  // Keep Render free tier alive by self-pinging every 10 minutes
  if (process.env.RENDER_EXTERNAL_URL) {
    setInterval(() => {
      const url = process.env.RENDER_EXTERNAL_URL + '/api/ping'
      const https = require('https')
      https.get(url, () => {}).on('error', () => {})
    }, 10 * 60 * 1000)
  }
})
