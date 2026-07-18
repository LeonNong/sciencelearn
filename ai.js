// AI helper — uses OpenAI ChatGPT
const https = require('https');

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

async function callGemini(prompt) {
  if (!OPENAI_KEY) {
    return { error: 'No AI API key configured. Add OPENAI_API_KEY to .env' };
  }

  const body = JSON.stringify({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1500,
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return resolve({ error: json.error.message });
          const text = json.choices?.[0]?.message?.content;
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
