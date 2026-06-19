const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const promClient = require('prom-client');
const { pool, ready } = require('./db');

const app = express();
const port = Number(process.env.PORT || 4000);
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const ollamaApiKey = process.env.OLLAMA_API_KEY;
const useOpenAI = process.env.USE_OPENAI === 'true' || openaiApiKey;
const jwtSecret = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'ppv-website-dev-secret';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register, prefix: 'ppv_' });

register.setDefaultLabels({ service: 'ppv-backend' });

const httpRequestDurationSeconds = new promClient.Histogram({
  name: 'ppv_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register]
});

const httpRequestsTotal = new promClient.Counter({
  name: 'ppv_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

function createAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

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

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  if (req.path === '/metrics') {
    return next();
  }

  const endTimer = httpRequestDurationSeconds.startTimer();

  res.on('finish', () => {
    const route = req.route?.path || req.path || 'unknown';
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode)
    };

    httpRequestsTotal.inc(labels);
    endTimer(labels);
  });

  return next();
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.get('/api/health', async (_req, res) => {
  try {
    await ready;
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/api/users', async (_req, res) => {
  try {
    await ready;
    const result = await pool.query('SELECT id, name, email, created_at FROM users ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ message: 'name is required' });
  }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'email is required' });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ message: 'password is required' });
  }

  try {
    await ready;
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, password]
    );
    const user = result.rows[0];
    return res.status(201).json({ user, token: createAuthToken(user) });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'email already exists' });
    }

    return res.status(500).json({ message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'email is required' });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ message: 'password is required' });
  }

  try {
    await ready;
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE email = $1 AND password = $2 LIMIT 1',
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    return res.json({ user, token: createAuthToken(user) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post('/api/ollama/chat', async (req, res) => {
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
          model: openaiModel,
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
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
