import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from './db';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;
let currentKey = '';

function getAiClient(apiKey: string) {
  if (!aiInstance || currentKey !== apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
    currentKey = apiKey;
  }
  return aiInstance;
}

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
    const { email, password, firstName, lastName } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hash]
    );
    const user = result.rows[0];
    
    const userRole = email === 'admin@txglobal.com.au' ? 'admin' : 'student';
    const joinedDate = new Date().toISOString();
    
    await query(
      `INSERT INTO profiles (id, email, first_name, last_name, role, tier, joined) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [user.id, user.email, firstName || '', lastName || '', userRole, 'free', joinedDate]
    );

    const token = jwt.sign({ id: user.id, email: user.email, role: userRole }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, role: userRole } });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Reset User Route (Temporary Helper)
router.get('/auth/reset-users', async (req, res) => {
  try {
    await query('DELETE FROM profiles WHERE email = $1', ['admin@txglobal.com.au']);
    await query('DELETE FROM users WHERE email = $1', ['admin@txglobal.com.au']);
    res.send('User admin@txglobal.com.au has been successfully deleted from your database. You can now go back to the Sign Up page and register cleanly!');
  } catch (e: any) {
    res.status(500).send('Error resetting user: ' + e.message);
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

    // Look up role from profiles table defensively
    let role = 'student';
    try {
      const profileRes = await query('SELECT role FROM profiles WHERE id = $1', [user.id]);
      if (profileRes.rows[0]?.role) {
        role = profileRes.rows[0].role;
      } else if (user.email === 'admin@txglobal.com.au') {
        role = 'admin';
      }
    } catch (err) {
      if (user.email === 'admin@txglobal.com.au') {
        role = 'admin';
      }
    }

    const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, role } });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/auth/session', authenticate, async (req: any, res) => {
  let role = req.user.role;
  if (!role) {
    try {
      const profileRes = await query('SELECT role FROM profiles WHERE id = $1', [req.user.id]);
      role = profileRes.rows[0]?.role || (req.user.email === 'admin@txglobal.com.au' ? 'admin' : 'student');
    } catch (err) {
      role = req.user.email === 'admin@txglobal.com.au' ? 'admin' : 'student';
    }
  }
  res.json({ user: { id: req.user.id, email: req.user.email, role } });
});

router.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    // Always return success to prevent email enumeration, but only send email if user exists
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 3600000); // 1 hour expiry
      
      await query(
        'UPDATE users SET reset_token = $1, reset_token_expires_at = $2 WHERE id = $3',
        [token, expires, user.id]
      );
      
      const resetLink = `${process.env.FRONTEND_URL || 'https://race.txglobal.com.au'}/reset-password?token=${token}`;
      
      // Configure Nodemailer SMTP Transporter
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = parseInt(process.env.SMTP_PORT || '587');
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || 'RANZCO RACE Exam Engine <noreply@txglobal.com.au>';
      
      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465, // True for port 465, false for other ports (like 587)
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });
        
        await transporter.sendMail({
          from: smtpFrom,
          to: user.email,
          subject: 'Reset your RANZCO RACE Exam Engine Password',
          text: `Hi,\n\nYou requested a password reset for your RANZCO RACE Exam Engine account.\nClick the link below to set a new password:\n\n${resetLink}\n\nThis link is valid for 1 hour.\nIf you did not request this, you can safely ignore this email.`,
          html: `<p>Hi,</p>
                 <p>You requested a password reset for your RANZCO RACE Exam Engine account.</p>
                 <p>Click the link below to set a new password:</p>
                 <p><a href="${resetLink}" style="display:inline-block;background-color:#4f46e5;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password</a></p>
                 <p>Alternatively, copy and paste this link into your browser:</p>
                 <p>${resetLink}</p>
                 <br>
                 <p>This link is valid for 1 hour.</p>
                 <p>If you did not request this, you can safely ignore this email.</p>`
        });
        console.log(`Password reset email successfully sent to ${user.email}`);
      } else {
        console.warn('SMTP settings are not configured. Logging reset link instead:');
        console.log(`Password Reset Link for ${user.email}: ${resetLink}`);
      }
    }
    
    res.json({ success: true, message: 'If this email address exists in our database, a password reset link has been sent!' });
  } catch (e: any) {
    console.error('Forgot password error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required.' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    
    // Find user with matching token that hasn't expired
    const result = await query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires_at > NOW()',
      [token]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset link.' });
    }
    
    // Hash new password and clear the reset token fields
    const hash = await bcrypt.hash(password, 10);
    await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires_at = NULL WHERE id = $2',
      [hash, user.id]
    );
    
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (e: any) {
    console.error('Reset password error:', e);
    res.status(400).json({ error: e.message });
  }
});

// Admin Authorization Middleware
export const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    // Use text cast on $1 to avoid uuid = text operator mismatch
    const userRes = await query("SELECT email FROM users WHERE id::text = $1", [req.user.id]);
    const userEmail = userRes.rows[0]?.email;
    const profileRes = await query("SELECT role FROM profiles WHERE id::text = $1", [req.user.id]);
    const role = profileRes.rows[0]?.role;
    if (role === 'admin' || userEmail === 'admin@txglobal.com.au' || req.user?.email === 'admin@txglobal.com.au') {
      req.user.role = 'admin';
      if (req.user && userEmail) req.user.email = userEmail;
      return next();
    }
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  } catch (err: any) {
    console.error('requireAdmin error:', err.message);
    // If DB query fails but the JWT email is the admin email, still allow through
    if (req.user?.email === 'admin@txglobal.com.au') {
      req.user.role = 'admin';
      return next();
    }
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
};

// Admin User Management Routes
router.get('/admin/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        u.id, 
        u.email, 
        COALESCE(p.first_name, '') AS "firstName", 
        COALESCE(p.last_name, '') AS "lastName", 
        COALESCE(p.role, 'student') AS role, 
        COALESCE(p.tier, 'free') AS tier, 
        p.tier_expiry AS "tierExpiry", 
        COALESCE(p.joined, '') AS joined,
        u.created_at
       FROM users u 
       LEFT JOIN profiles p ON u.id::text = p.id::text`
    );
    const normalized = result.rows.map((row: any) => {
      return {
        id: row.id,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role,
        tier: row.tier,
        tierExpiry: row.tierExpiry,
        joined: row.joined || (row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '')
      };
    });
    res.json(normalized);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/admin/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { email, role, tier } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    
    // Check if user already exists
    const checkUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    const tempPassword = crypto.randomBytes(16).toString('hex');
    const hash = await bcrypt.hash(tempPassword, 10);
    
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 86400000 * 7); // 7 days welcome expiry
    
    const userResult = await query(
      'INSERT INTO users (email, password_hash, reset_token, reset_token_expires_at) VALUES ($1, $2, $3, $4) RETURNING id, email',
      [email, hash, token, expires]
    );
    const user = userResult.rows[0];
    const joinedDate = new Date().toISOString().split('T')[0];
    
    await query(
      `INSERT INTO profiles (id, email, first_name, last_name, role, tier, joined) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [user.id, user.email, '', '', role || 'student', tier || 'free', joinedDate]
    );
    
    const welcomeLink = `${process.env.FRONTEND_URL || 'https://race.txglobal.com.au'}/reset-password?token=${token}`;
    
    // Email the user a welcome invitation link
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'RANZCO RACE Exam Engine <noreply@txglobal.com.au>';
    
    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass }
      });
      
      await transporter.sendMail({
        from: smtpFrom,
        to: user.email,
        subject: 'Welcome to RANZCO RACE Exam Engine!',
        text: `Hi,\n\nYou have been invited to join the RANZCO RACE Exam Engine.\nClick the link below to set your password and access your account:\n\n${welcomeLink}\n\nThis link is valid for 7 days.`,
        html: `<p>Hi,</p>
               <p>You have been invited to join the RANZCO RACE Exam Engine.</p>
               <p>Click the link below to set your password and access your account:</p>
               <p><a href="${welcomeLink}" style="display:inline-block;background-color:#4f46e5;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">Set Password</a></p>
               <br>
               <p>This link is valid for 7 days.</p>`
      });
      console.log(`User invited, welcome email sent to ${user.email}`);
    } else {
      console.warn('SMTP not configured. Invited user welcome link:');
      console.log(`Welcome Link for ${user.email}: ${welcomeLink}`);
    }
    
    res.json({ success: true, user });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/admin/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, tier } = req.body;
    
    await query(
      `UPDATE profiles SET 
         first_name = $1, 
         last_name = $2, 
         role = $3, 
         tier = $4, 
         updated_at = NOW() 
       WHERE id::text = $5`,
      [firstName || '', lastName || '', role || 'student', tier || 'free', id]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/admin/users/:id', authenticate, requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }
    await query('DELETE FROM users WHERE id::text = $1', [id]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/admin/upload-image', authenticate, requireAdmin, async (req, res) => {
  try {
    const { fileName, fileDataB64 } = req.body;
    if (!fileName || !fileDataB64) {
      return res.status(400).json({ error: 'Missing fileName or fileDataB64.' });
    }
    
    const rawB64 = fileDataB64.indexOf('base64,') > -1 ? fileDataB64.split('base64,').pop() : fileDataB64;
    if (!rawB64) return res.status(400).json({ error: 'Invalid base64 data.' });
    
    const buffer = Buffer.from(rawB64, 'base64');
    const cleanName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueName = `${Date.now()}_${cleanName}`;
    
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = path.join(uploadDir, uniqueName);
    fs.writeFileSync(filePath, buffer);
    
    res.json({ success: true, url: `/uploads/${uniqueName}` });
  } catch (e: any) {
    console.error('Image upload error:', e);
    res.status(500).json({ error: e.message });
  }
});
router.post('/admin/parse-docx', authenticate, requireAdmin, async (req, res) => {
  try {
    const { fileDataB64 } = req.body;
    if (!fileDataB64) {
      return res.status(400).json({ error: 'Missing fileDataB64.' });
    }
    const rawB64 = fileDataB64.indexOf('base64,') > -1 ? fileDataB64.split('base64,').pop() : fileDataB64;
    if (!rawB64) return res.status(400).json({ error: 'Invalid base64 data.' });
    
    const buffer = Buffer.from(rawB64, 'base64');
    
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    
    res.json({ text: result.value });
  } catch (e: any) {
    console.error('DOCX parsing error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/ai/generate', authenticate, async (req: any, res) => {
  try {
    const { parts, config, modelOverride, provider, customKey } = req.body;
    
    // Retrieve API key: custom client override key or Render environment variable
    const apiKey = customKey || process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured on Render. Please configure it in your Render dashboard Environment tab.' });
    }

    const selectedModel = modelOverride || 'gemini-2.5-flash';

    // Route to Google GenAI SDK if google provider
    if (provider === 'google' || !provider) {
      const ai = getAiClient(apiKey);
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: parts,
        config: config
      });
      return res.json({ text: response.text });
    }
    
    // Support OpenAI / DeepSeek fallbacks if configured in client
    if (provider === 'openai' || provider === 'deepseek') {
      const baseUrl = provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions';
      
      let userMessageContent: any[] | string = [];
      if (parts.length === 1 && typeof parts[0] === 'string') {
        userMessageContent = parts[0];
      } else {
        userMessageContent = parts.map((p: any) => {
          if (p.text) return { type: 'text', text: p.text };
          if (p.inlineData) {
            return {
              type: 'image_url',
              image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` }
            };
          }
          return { type: 'text', text: String(p) };
        });
      }

      const messages = [];
      if (config?.systemInstruction) {
        messages.push({ role: 'system', content: config.systemInstruction });
      }
      messages.push({ role: 'user', content: userMessageContent });

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          temperature: config?.temperature ?? 0.7,
          response_format: config?.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI/DeepSeek API Error: ${errText}`);
      }

      const resData = await response.json();
      const text = resData.choices?.[0]?.message?.content || '';
      return res.json({ text });
    }

    res.status(400).json({ error: `Unsupported provider: ${provider}` });
  } catch (e: any) {
    console.error('Proxy AI execution failed:', e);
    res.status(500).json({ error: e.message || 'AI Proxy failed.' });
  }
});

// Profile Routes
router.get('/profiles', authenticate, async (req: any, res) => {
  try {
    let result = await query('SELECT * FROM profiles WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      console.log(`Profile missing for user ${req.user.email}, generating defensively...`);
      const userRole = req.user.email === 'admin@txglobal.com.au' ? 'admin' : 'student';
      const joinedDate = new Date().toISOString();
      await query(
        `INSERT INTO profiles (id, email, first_name, last_name, role, tier, joined) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [req.user.id, req.user.email, '', '', userRole, 'free', joinedDate]
      );
      result = await query('SELECT * FROM profiles WHERE id = $1', [req.user.id]);
    }
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
    const normalized = result.rows.map((row: any) => {
      let qData = row.data;
      if (row.data && row.data.data) {
        qData = row.data.data;
      }
      return {
        id: row.id,
        type: row.type || (row.data && row.data.type) || 'VSAQ',
        topic: row.topic || (row.data && row.data.topic) || 'General',
        paper: (row.data && row.data.paper) || 'Unknown',
        year: (row.data && row.data.year) || 'Unknown',
        questionLabel: (row.data && row.data.questionLabel) || '',
        data: qData,
        used: (row.data && row.data.used) || false
      };
    });
    res.json(normalized);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/questions/upsert', authenticate, async (req: any, res) => {
  try {
    const bank = req.body;
    for (const q of bank) {
      let qData = q.data;
      if (q.data && q.data.data) {
        qData = q.data.data;
      }
      await query(
        'INSERT INTO questions (id, type, topic, data) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, topic = EXCLUDED.topic, data = EXCLUDED.data',
        [q.id, q.type, q.topic, JSON.stringify({
          id: q.id,
          type: q.type,
          topic: q.topic,
          paper: q.paper || 'Unknown',
          year: q.year || 'Unknown',
          questionLabel: q.questionLabel || '',
          data: qData,
          used: q.used || false
        })]
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

// Submissions Routes
router.post('/submissions', authenticate, async (req: any, res) => {
  try {
    const { exam_type, score, max_score, time_taken, answers } = req.body;
    const result = await query(
      'INSERT INTO submissions (user_id, email, exam_type, score, max_score, time_taken, answers) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [req.user.id, req.user.email || 'unknown', exam_type, score, max_score, time_taken, JSON.stringify(answers)]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/admin/submissions', authenticate, requireAdmin, async (req: any, res) => {
  try {
    const result = await query('SELECT * FROM submissions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/admin/submissions/:id', authenticate, requireAdmin, async (req: any, res) => {
  try {
    await query('DELETE FROM submissions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
