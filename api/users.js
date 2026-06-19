const { pool } = require('../backend/src/db');
const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'ppv-website-dev-secret';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const result = await pool.query('SELECT id, name, email, created_at FROM users ORDER BY id');
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  } else if (req.method === 'POST') {
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
      const user = result.rows[0];
      return res.status(201).json({ user, token: createAuthToken(user) });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'email already exists' });
      }
      return res.status(500).json({ message: error.message });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
