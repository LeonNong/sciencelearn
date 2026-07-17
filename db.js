const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Helper: throw on Supabase error
function check(error, context) {
  if (error) throw new Error(`Supabase error (${context}): ${error.message}`);
}

const db = {
  // ── USERS ──────────────────────────────────────────────
  async getUserByEmail(email) {
    const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
    if (error && error.code !== 'PGRST116') check(error, 'getUserByEmail');
    return data;
  },
  async getUserByUsername(username) {
    const { data, error } = await supabase.from('users').select('*').eq('username', username).single();
    if (error && error.code !== 'PGRST116') check(error, 'getUserByUsername');
    return data;
  },
  async getUserById(id) {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') check(error, 'getUserById');
    return data;
  },
  async createUser(user) {
    const { data, error } = await supabase.from('users').insert(user).select().single();
    check(error, 'createUser'); return data;
  },
  async updateUser(id, updates) {
    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
    check(error, 'updateUser'); return data;
  },
  async countUsers() {
    const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
    check(error, 'countUsers'); return count;
  },

  // ── ROOMS ──────────────────────────────────────────────
  async getRoomsForUser(userId) {
    const { data, error } = await supabase.from('rooms').select(`
      *, owner:users!owner_id(username),
      room_members!inner(user_id)
    `).or(`is_public.eq.true,owner_id.eq.${userId}`);
    check(error, 'getRoomsForUser'); return data;
  },
  async getRoomById(id) {
    const { data, error } = await supabase.from('rooms').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') check(error, 'getRoomById');
    return data;
  },
  async getRoomByInviteCode(code) {
    const { data, error } = await supabase.from('rooms').select('*').eq('invite_code', code).single();
    if (error && error.code !== 'PGRST116') check(error, 'getRoomByInviteCode');
    return data;
  },
  async createRoom(room) {
    const { data, error } = await supabase.from('rooms').insert(room).select().single();
    check(error, 'createRoom'); return data;
  },

  // ── ROOM MEMBERS ───────────────────────────────────────
  async isRoomMember(roomId, userId) {
    const { data, error } = await supabase.from('room_members').select('user_id').eq('room_id', roomId).eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') check(error, 'isRoomMember');
    return !!data;
  },
  async addRoomMember(roomId, userId) {
    const { error } = await supabase.from('room_members').upsert({ room_id: roomId, user_id: userId });
    check(error, 'addRoomMember');
  },
  async getRoomMembers(roomId) {
    const { data, error } = await supabase.from('room_members').select('users(id, username, avatar_color, is_admin, level)').eq('room_id', roomId);
    check(error, 'getRoomMembers');
    return data.map(r => r.users);
  },

  // ── MESSAGES ───────────────────────────────────────────
  async getMessages(roomId) {
    const { data, error } = await supabase.from('messages').select('*, users(username, avatar_color)').eq('room_id', roomId).order('created_at', { ascending: true }).limit(100);
    check(error, 'getMessages'); return data;
  },
  async createMessage(msg) {
    const { data, error } = await supabase.from('messages').insert(msg).select().single();
    check(error, 'createMessage'); return data;
  },

  // ── FLASHCARDS ─────────────────────────────────────────
  async getFlashcards(userId) {
    const { data, error } = await supabase.from('flashcards').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    check(error, 'getFlashcards'); return data;
  },
  async createFlashcard(card) {
    const { data, error } = await supabase.from('flashcards').insert(card).select().single();
    check(error, 'createFlashcard'); return data;
  },
  async updateFlashcard(id, updates) {
    const { data, error } = await supabase.from('flashcards').update(updates).eq('id', id).select().single();
    check(error, 'updateFlashcard'); return data;
  },
  async deleteFlashcard(id, userId) {
    const { error } = await supabase.from('flashcards').delete().eq('id', id).eq('user_id', userId);
    check(error, 'deleteFlashcard');
  },
  async countFlashcards(userId) {
    const { count, error } = await supabase.from('flashcards').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    check(error, 'countFlashcards'); return count;
  },

  // ── QUIZ ATTEMPTS ──────────────────────────────────────
  async createQuizAttempt(attempt) {
    const { error } = await supabase.from('quiz_attempts').insert(attempt);
    check(error, 'createQuizAttempt');
  },
  async getQuizAttempts(userId) {
    const { data, error } = await supabase.from('quiz_attempts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
    check(error, 'getQuizAttempts'); return data;
  },

  // ── STUDY SESSIONS ─────────────────────────────────────
  async createSession(session) {
    const { error } = await supabase.from('study_sessions').insert(session);
    check(error, 'createSession');
  },
  async getSessionsBySubject(userId) {
    const { data, error } = await supabase.from('study_sessions').select('subject, duration_minutes').eq('user_id', userId);
    check(error, 'getSessionsBySubject');
    const grouped = {};
    for (const s of data) {
      grouped[s.subject] = (grouped[s.subject] || 0) + s.duration_minutes;
    }
    return Object.entries(grouped).map(([subject, total]) => ({ subject, total }));
  },

  // ── BADGES ─────────────────────────────────────────────
  async getBadges(userId) {
    const { data, error } = await supabase.from('badges').select('badge_key').eq('user_id', userId);
    check(error, 'getBadges'); return data.map(b => b.badge_key);
  },
  async grantBadge(userId, badgeKey) {
    const { error } = await supabase.from('badges').upsert({ user_id: userId, badge_key: badgeKey }, { onConflict: 'user_id,badge_key', ignoreDuplicates: true });
    if (error && !error.message.includes('duplicate')) check(error, 'grantBadge');
  },

  // ── STUDY PLANS ────────────────────────────────────────
  async createStudyPlan(plan) {
    const { data, error } = await supabase.from('study_plans').insert(plan).select().single();
    check(error, 'createStudyPlan'); return data;
  },
  async getStudyPlans(userId) {
    const { data, error } = await supabase.from('study_plans').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    check(error, 'getStudyPlans'); return data;
  },
};

module.exports = db;
