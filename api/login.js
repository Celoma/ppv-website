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
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

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

    const user = result.rows[0];
    return res.json({ user, token: createAuthToken(user) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
