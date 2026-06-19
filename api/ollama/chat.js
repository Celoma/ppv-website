const jwt = require('jsonwebtoken');
const openaiApiKey = process.env.OPENAI_API_KEY;
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const ollamaApiKey = process.env.OLLAMA_API_KEY;
const useOpenAI = process.env.USE_OPENAI === 'true' || openaiApiKey;
const jwtSecret = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'ppv-website-dev-secret';

function requireAuth(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }

  try {
    return jwt.verify(token, jwtSecret);
  } catch (_error) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authResult = requireAuth(req, res);
  if (!authResult) {
    return;
  }

  const { model, messages, stream = false } = req.body || {};

  if (!model || typeof model !== 'string') {
    return res.status(400).json({ message: 'model is required' });
  }

  if (!Array.isArray(messages)) {
    return res.status(400).json({ message: 'messages must be an array' });
  }

  try {
    let responseData;

    if (useOpenAI) {
      // Utiliser OpenAI en production
      if (!openaiApiKey) {
        return res.status(500).json({ message: 'OPENAI_API_KEY not configured' });
      }

      console.log(`Sending request to OpenAI: model=${model}, messages=${JSON.stringify(messages)}, stream=${stream}`);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: model === 'llama3.2:1b' ? 'gpt-3.5-turbo' : model,
          messages,
          stream: Boolean(stream)
        })
      });

      const responseText = await response.text();

      if (!response.ok) {
        return res.status(response.status).json({
          message: responseText || 'Impossible de joindre OpenAI'
        });
      }

      if (!responseText.trim()) {
        return res.status(502).json({ message: 'Réponse vide reçue depuis OpenAI' });
      }

      const data = JSON.parse(responseText);
      
      // Adapter le format de réponse pour correspondre à celui d'Ollama
      responseData = {
        message: {
          role: 'assistant',
          content: data.choices[0].message.content
        }
      };
    } else {
      // Utiliser Ollama en local
      console.log(`Sending request to Ollama: model=${model}, messages=${JSON.stringify(messages)}, stream=${stream}`);

      const headers = {
        'Content-Type': 'application/json'
      };

      // Ajouter l'authentification si une clé API Ollama est fournie
      if (ollamaApiKey) {
        headers['Authorization'] = `Bearer ${ollamaApiKey}`;
      }

      const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          stream: Boolean(stream)
        })
      });

      const responseText = await response.text();

      if (!response.ok) {
        return res.status(response.status).json({
          message: responseText || 'Impossible de joindre Ollama'
        });
      }

      if (!responseText.trim()) {
        return res.status(502).json({ message: 'Réponse vide reçue depuis Ollama' });
      }

      responseData = JSON.parse(responseText);
    }

    return res.json(responseData);
  } catch (error) {
    return res.status(502).json({ message: error.message });
  }
}
