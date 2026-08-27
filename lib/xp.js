const db = require('../db');

async function awardXP(userId, amount) {
  try {
    const user = await db.getUserById(userId);
    if (!user) return;
    const newXp = user.xp + amount;
    const newLevel = Math.floor(newXp / 100) + 1;
    await db.updateUser(userId, { xp: newXp, level: newLevel });
    await checkBadges(userId, newXp);
  } catch (e) {
    console.error('awardXP error:', e.message);
  }
}

async function checkBadges(userId, xp) {
  try {
    const existing = await db.getBadges(userId);
    const grant = async (key) => {
      if (!existing.includes(key)) await db.grantBadge(userId, key);
    };
    if (xp >= 100) await grant('xp_100');
    if (xp >= 500) await grant('xp_500');
    const cardCount = await db.countFlashcards(userId);
    if (cardCount >= 10) await grant('flashcard_10');
    const attempts = await db.getQuizAttempts(userId);
    if (attempts.length >= 1) await grant('first_quiz');
  } catch (e) {
    console.error('checkBadges error:', e.message);
  }
}

module.exports = { awardXP, checkBadges };
