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
const db = require('./db');
const { awardXP } = require('./lib/xp');
const { JWT_SECRET } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

const CLIENT_ORIGINS = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(s => s.trim())
  : ['http://localhost:5175', 'http://localhost:5176', 'http://localhost:5173'];

const corsOptions = {
  origin: (origin, callback) => {
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

// ==================== ROUTES ====================

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/ai',          require('./routes/ai'));
app.use('/api/flashcards',  require('./routes/flashcards'));
app.use('/api/planner',     require('./routes/planner'));
app.use('/api/sessions',    require('./routes/sessions'));
app.use('/api/lare',        require('./routes/lare'));
app.use('/api/grades',      require('./routes/grades'));
app.use('/api/notes',       require('./routes/notes'));
app.use('/api/lang',        require('./routes/language'));
app.use('/api/feedback',    require('./routes/feedback'));
app.use('/api/rooms',       require('./routes/rooms'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/dashboard',   require('./routes/dashboard'));

// ==================== MISC ====================

app.get('/api/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));

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
      const msg = await db.createMessage({
        room_id: roomId, user_id: socket.user.id,
        content: content.trim(), is_anonymous: !!isAnonymous,
      });
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
            is_mine: ts.user.id === socket.user.id,
          });
        }
      }
      await awardXP(socket.user.id, 1);
    } catch (e) {
      console.error('send_message error:', e.message);
    }
  });
});

// ==================== START ====================

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`LearnWay server at http://localhost:${PORT}`);

  // Keep Render free tier alive by self-pinging every 10 minutes
  if (process.env.RENDER_EXTERNAL_URL) {
    setInterval(() => {
      const url = process.env.RENDER_EXTERNAL_URL + '/api/ping';
      const https = require('https');
      https.get(url, () => {}).on('error', () => {});
    }, 10 * 60 * 1000);
  }
});
