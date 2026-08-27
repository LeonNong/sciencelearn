const express = require('express');
const router = express.Router();
const { callGeminiVision } = require('../ai');
const { authMiddleware } = require('../middleware/auth');
const supabase = require('../middleware/supabase');

// POST /api/grades/scan
router.post('/scan', authMiddleware, async (req, res) => {
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
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error('Grade scan raw response:', text.slice(0, 500));
      return res.status(422).json({ error: 'Could not extract grades from image. Try a clearer photo.' });
    }
    const grades = JSON.parse(match[0]);
    res.json({ grades: Array.isArray(grades) ? grades : [grades] });
  } catch (e) {
    console.error('Grade scan parse error:', e.message, result.text?.slice(0, 500));
    res.status(422).json({ error: 'Could not parse grades from image. Try a clearer photo.' });
  }
});

// POST /api/grades/scan-comments
router.post('/scan-comments', authMiddleware, async (req, res) => {
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

// GET /api/grades
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('exam_grades').select('*')
      .eq('user_id', req.user.id).order('date', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/grades
router.post('/', authMiddleware, async (req, res) => {
  const { subject, label, score, date, comment } = req.body;
  if (!subject || !label || score === undefined || !date) return res.status(400).json({ error: 'All fields required' });
  if (score < 0 || score > 100) return res.status(400).json({ error: 'Score must be 0-100' });
  try {
    const { data, error } = await supabase.from('exam_grades').insert({
      user_id: req.user.id, subject, label, score: Number(score), date, comment: comment || null,
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/grades/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase.from('exam_grades').delete()
      .eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
