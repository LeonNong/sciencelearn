// AI helper — uses OpenAI ChatGPT
const https = require('https');

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

async function callGemini(prompt, maxTokens = 1500, jsonMode = false) {
  if (!OPENAI_KEY) {
    return { error: 'No AI API key configured. Add OPENAI_API_KEY to .env' };
  }

  const payload = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: maxTokens,
  };
  if (jsonMode) payload.response_format = { type: 'json_object' };

  const body = JSON.stringify(payload);

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
          const choice = json.choices?.[0];
          if (choice?.finish_reason === 'length') {
            return resolve({ error: 'AI response was cut off. Try shorter writing or fewer words to analyse.' });
          }
          const text = choice?.message?.content;
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

// Vision call — accepts base64 image + text prompt
async function callGeminiVision(prompt, base64Image, mimeType = 'image/jpeg') {
  if (!OPENAI_KEY) {
    return { error: 'No AI API key configured. Add OPENAI_API_KEY to .env' };
  }

  const body = JSON.stringify({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
      ]
    }],
    temperature: 0.2,
    max_tokens: 2000,
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

module.exports = { callGemini, callGeminiVision };
