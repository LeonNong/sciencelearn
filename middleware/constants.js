const AVATAR_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
];

const BADGES = {
  first_quiz:    { key: 'first_quiz',    name: 'Quiz Starter',   icon: '🧪', desc: 'Completed your first quiz' },
  streak_7:      { key: 'streak_7',      name: 'Week Warrior',   icon: '🔥', desc: '7-day study streak' },
  xp_100:        { key: 'xp_100',        name: 'Scholar',        icon: '📚', desc: 'Earned 100 XP' },
  xp_500:        { key: 'xp_500',        name: 'Science Ace',    icon: '🏆', desc: 'Earned 500 XP' },
  flashcard_10:  { key: 'flashcard_10',  name: 'Card Collector', icon: '🃏', desc: 'Created 10 flashcards' },
  perfect_score: { key: 'perfect_score', name: 'Perfect Score',  icon: '⭐', desc: 'Got 100% on a quiz' },
};

module.exports = { AVATAR_COLORS, BADGES };
