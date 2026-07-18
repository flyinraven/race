import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from './db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-prod';

// Auth Middleware
export const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Auth Routes
router.post('/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hash]
    );
    const user = result.rows[0];
    
    // Create empty profile
    await query(
      'INSERT INTO profiles (id, email) VALUES ($1, $2)',
      [user.id, user.email]
    );

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/auth/session', authenticate, (req: any, res) => {
  res.json({ user: req.user });
});

// Profile Routes
router.get('/profiles', authenticate, async (req: any, res) => {
  try {
    const result = await query('SELECT * FROM profiles WHERE id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/profiles', authenticate, async (req: any, res) => {
  try {
    const profile = req.body;
    // Basic upsert simulation
    await query(
      'UPDATE profiles SET first_name = $1, last_name = $2, target_exam = $3, exam_date = $4, avatar_url = $5, updated_at = NOW() WHERE id = $6',
      [profile.first_name, profile.last_name, profile.target_exam, profile.exam_date, profile.avatar_url, req.user.id]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Settings Routes
router.get('/settings/:id', authenticate, async (req: any, res) => {
  try {
    const result = await query('SELECT value FROM settings WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.json(null);
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/settings', authenticate, async (req: any, res) => {
  try {
    const { id, value } = req.body;
    await query(
      'INSERT INTO settings (id, value) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()',
      [id, value]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Questions Routes
router.get('/questions', authenticate, async (req: any, res) => {
  try {
    const result = await query('SELECT * FROM questions');
    res.json(result.rows);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/questions/upsert', authenticate, async (req: any, res) => {
  try {
    const bank = req.body;
    for (const q of bank) {
      await query(
        'INSERT INTO questions (id, type, topic, data) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, topic = EXCLUDED.topic, data = EXCLUDED.data',
        [q.id, q.type, q.topic, JSON.stringify(q)]
      );
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/questions/delete', authenticate, async (req: any, res) => {
  try {
    const { ids } = req.body;
    await query('DELETE FROM questions WHERE id = ANY($1::text[])', [ids]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});



// Email Templates
router.get('/email_templates', authenticate, async (req: any, res) => {
  try {
    const result = await query('SELECT * FROM email_templates');
    res.json(result.rows);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/email_templates/upsert', authenticate, async (req: any, res) => {
  try {
    const template = req.body;
    await query(
      'INSERT INTO email_templates (id, subject, html) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject, html = EXCLUDED.html, updated_at = NOW()',
      [template.id, template.subject, template.html]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
export default router;
