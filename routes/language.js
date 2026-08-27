const express = require('express');
const router = express.Router();
const { callGemini } = require('../ai');
const { authMiddleware } = require('../middleware/auth');
const supabase = require('../middleware/supabase');

// GET /api/lang/vocab
router.get('/vocab', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('lang_vocab').select('*')
      .eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/lang/vocab/generate
router.post('/vocab/generate', authMiddleware, async (req, res) => {
  const { word, language, translateFrom } = req.body;
  if (!word) return res.status(400).json({ error: 'Word required' });
  const isAfrikaans = (language || '').toLowerCase() === 'afrikaans';

  const targetWord = translateFrom
    ? `the ${language} translation of the ${translateFrom} word "${word}"`
    : `"${word}"`;
  const wordInstruction = translateFrom
    ? `The student entered the ${translateFrom} word "${word}". First identify the correct ${language} translation, then use that as the word field.`
    : '';
  const prompt = `${wordInstruction}
For the ${language} word ${targetWord}, return ONLY valid JSON (no markdown):
{
  "word": "the ${language} word${translateFrom ? ` (translation of ${word})` : ''}",
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
    const firstMeaning = entry.meanings?.[0] || {};
    const { data, error } = await supabase.from('lang_vocab').insert({
      user_id: req.user.id,
      word: entry.word,
      language: entry.language,
      part_of_speech: firstMeaning.part_of_speech || '',
      definition: JSON.stringify(entry.meanings || []),
      example: firstMeaning.example || '',
      translation: entry.translation || '',
      ease_factor: 2.5, interval: 1,
      next_review: new Date().toISOString(),
      correct: 0, incorrect: 0,
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate vocab: ' + e.message });
  }
});

// POST /api/lang/vocab/:id/refresh
router.post('/vocab/:id/refresh', authMiddleware, async (req, res) => {
  try {
    const { data: card } = await supabase.from('lang_vocab').select('*')
      .eq('id', req.params.id).eq('user_id', req.user.id).single();
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
    const { data, error } = await supabase.from('lang_vocab').update({
      part_of_speech: firstMeaning.part_of_speech || '',
      definition: JSON.stringify(entry.meanings || []),
      example: firstMeaning.example || '',
      translation: entry.translation || '',
    }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to refresh: ' + e.message });
  }
});

// PATCH /api/lang/vocab/:id/review
router.patch('/vocab/:id/review', authMiddleware, async (req, res) => {
  const { quality } = req.body;
  try {
    const { data: card } = await supabase.from('lang_vocab').select('*')
      .eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (!card) return res.status(404).json({ error: 'Word not found' });
    let ef = Math.max(1.3, card.ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    let interval = quality < 3 ? 1 : Math.round(card.interval === 1 ? 6 : card.interval * ef);
    const nextReview = new Date(Date.now() + interval * 86400000).toISOString();
    const correct = quality >= 3 ? card.correct + 1 : card.correct;
    const incorrect = quality < 3 ? card.incorrect + 1 : card.incorrect;
    const { data, error } = await supabase.from('lang_vocab').update({
      ease_factor: ef, interval, next_review: nextReview, correct, incorrect,
    }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/lang/vocab/:id
router.delete('/vocab/:id', authMiddleware, async (req, res) => {
  try {
    await supabase.from('lang_vocab').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/lang/quiz
router.post('/quiz', authMiddleware, async (req, res) => {
  const { language, level = 'intermediate', weakWords = [] } = req.body;
  const weakHint = weakWords.length
    ? `Focus on these words the student struggled with: ${weakWords.slice(0, 5).join(', ')}.`
    : '';
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
  } catch {
    res.status(500).json({ error: 'Failed to generate quiz.' });
  }
});

// POST /api/lang/grammar
router.post('/grammar', authMiddleware, async (req, res) => {
  const { language, type = 'mixed' } = req.body;
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
  } catch {
    res.status(500).json({ error: 'Failed to generate grammar exercises.' });
  }
});

// POST /api/lang/writing
router.post('/writing', authMiddleware, async (req, res) => {
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
3. For each native-language word found, provide the ${language} translation — extract INDIVIDUAL WORDS only, never whole phrases or sentences
4. Write all feedback, strengths, and suggestions in ${nativeLanguage}

Return ONLY valid JSON:
{
  "ai_score": 0-100,
  "ai_warning": "brief explanation in ${nativeLanguage} if score > 60, else null",
  "native_words": [
    { "original": "the single native WORD as written (one word only, not a phrase)", "translation": "single ${language} equivalent word", "definition": "brief meaning in ${nativeLanguage}", "example": "example sentence in ${language}" }
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
  } catch {
    res.status(500).json({ error: 'Failed to analyse writing.' });
  }
});

// GET /api/lang/progress
router.get('/progress', authMiddleware, async (req, res) => {
  try {
    const { data: vocab } = await supabase.from('lang_vocab').select('*').eq('user_id', req.user.id);
    const total = vocab?.length || 0;
    const mastered = vocab?.filter(v => v.correct >= 3 && v.incorrect === 0).length || 0;
    const learning = vocab?.filter(v => v.correct > 0 || v.incorrect > 0).length || 0;
    const dueNow = vocab?.filter(v => new Date(v.next_review) <= new Date()).length || 0;
    const totalCorrect = vocab?.reduce((a, v) => a + v.correct, 0) || 0;
    const totalIncorrect = vocab?.reduce((a, v) => a + v.incorrect, 0) || 0;
    res.json({ total, mastered, learning, dueNow, totalCorrect, totalIncorrect });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
