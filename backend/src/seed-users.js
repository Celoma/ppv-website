const { pool } = require('./db');

const users = [
  {
    name: 'Alice Martin',
    email: 'alice@example.com',
    password: 'password123'
  },
  {
    name: 'Benoit Durand',
    email: 'benoit@example.com',
    password: 'secret456'
  },
  {
    name: 'Chloe Bernard',
    email: 'chloe@example.com',
    password: 'admin789'
  }
];

async function seedUsers() {
  try {
    for (const user of users) {
      await pool.query(
        `INSERT INTO users (name, email, password)
         VALUES ($1, $2, $3)
         ON CONFLICT (email)
         DO UPDATE SET
           name = EXCLUDED.name,
           password = EXCLUDED.password`,
        [user.name, user.email, user.password]
      );
    }

    console.log(`Seeded ${users.length} users successfully.`);
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedUsers();