const express = require('express');
const cors = require('cors');
const promClient = require('prom-client');
const jwt = require('jsonwebtoken');
const { pool, ready } = require('./db');

const app = express();
const port = Number(process.env.PORT || 4000);

// =====================
// ENV
// =====================
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';

const useOpenAI = process.env.USE_OPENAI === 'true' || openaiApiKey;
const jwtSecret = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'ppv-website-dev-secret';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

// =====================
// PROMETHEUS
// =====================
const register = new promClient.Registry();

promClient.collectDefaultMetrics({ register, prefix: 'ppv_' });

register.setDefaultLabels({ service: 'ppv-backend' });

const httpRequestsTotal = new promClient.Counter({
  name: 'ppv_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpRequestDurationSeconds = new promClient.Histogram({
  name: 'ppv_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register]
});

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path || req.path || 'unknown';

    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode)
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, duration);
  });

  next();
});

// =====================
// AUTH
// =====================
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
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
    return null;
  }
}

// =====================
// ROUTES
// =====================
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.send(await register.metrics());
});

app.get('/api/health', async (_req, res) => {
  try {
    await ready;
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/users', async (_req, res) => {
  try {
    await ready;
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'missing fields' });
  }

  try {
    await ready;

    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, password]
    );

    const user = result.rows[0];
    res.status(201).json({ user, token: createAuthToken(user) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'email already exists' });
    }
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'missing fields' });
  }

  try {
    await ready;

    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE email=$1 AND password=$2 LIMIT 1',
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    res.json({ user, token: createAuthToken(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================
// START
// =====================
app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});

app.post('/api/ollama/chat', async (req, res) => {
  try {
    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: req.body.model || 'llama3.2:1b',
        messages: req.body.messages,
        stream: false
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: text });
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});