// AI helper — uses Google Gemini (free tier)
// Get your free key at https://aistudio.google.com
const https = require('https');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-1.5-flash';

async function callGemini(prompt) {
  if (!GEMINI_KEY || GEMINI_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    return { error: 'No AI API key configured. Add GEMINI_API_KEY to .env' };
  }

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          resolve({ text: text || 'No response from AI.' });
        } catch {
          resolve({ error: 'Failed to parse AI response.' });
        }
      });
    });
    req.on('error', () => resolve({ error: 'AI request failed.' }));
    req.write(body);
    req.end();
  });
}

module.exports = { callGemini };
