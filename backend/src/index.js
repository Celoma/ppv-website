const express = require('express');
const cors = require('cors');
const client = require('prom-client');
const { pool } = require('./db');

const app = express();
const port = Number(process.env.PORT || 4000);
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

client.collectDefaultMetrics();

const httpRequestsTotal = new client.Counter({
  name: 'ppv_http_requests_total',
  help: 'Total number of HTTP requests received by the backend',
  labelNames: ['method', 'route', 'status']
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'ppv_http_request_duration_seconds',
  help: 'HTTP request duration in seconds for the backend',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
});

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
    const route = req.route?.path || req.path || 'unknown';

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status: String(res.statusCode)
    });

    httpRequestDurationSeconds.observe({
      method: req.method,
      route,
      status: String(res.statusCode)
    }, durationSeconds);
  });

  next();
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.send(await client.register.metrics());
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/api/users', async (_req, res) => {
  try {
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
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, password]
    );
    return res.status(201).json(result.rows[0]);
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
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE email = $1 AND password = $2 LIMIT 1',
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    return res.json({ user: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post('/api/ollama/chat', async (req, res) => {
  const { model, messages, stream = false } = req.body || {};

  if (!model || typeof model !== 'string') {
    return res.status(400).json({ message: 'model is required' });
  }

  if (!Array.isArray(messages)) {
    return res.status(400).json({ message: 'messages must be an array' });
  }
  console.log(`Sending request to Ollama: model=${model}, messages=${JSON.stringify(messages)}, stream=${stream}`);

  try {
    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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

    return res.type('json').send(responseText);
  } catch (error) {
    return res.status(502).json({ message: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
