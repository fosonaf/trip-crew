import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database';
import { generateToken } from '../config/jwt';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, phone, avatarUrl } = req.body;

    if (!phone || !phone.trim()) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, phone, avatar_url) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, first_name, last_name, phone, avatar_url`,
      [email, hashedPassword, firstName, lastName, phone.trim(), avatarUrl ?? null]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        avatarUrl: user.avatar_url,
      },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        avatarUrl: user.avatar_url,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.first_name,
        lastName: req.user.last_name,
        phone: req.user.phone,
        avatarUrl: req.user.avatar_url,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { email, firstName, lastName, phone, avatarUrl } = req.body as {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatarUrl?: string | null;
    };

    if (phone !== undefined && !phone.trim()) {
      res.status(400).json({ error: 'Phone number cannot be empty' });
      return;
    }

    if (email) {
      const existingEmail = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id <> $2',
        [email, userId]
      );
      if (existingEmail.rows.length > 0) {
        res.status(400).json({ error: 'Email already in use' });
        return;
      }
    }

    const current = await pool.query(
      'SELECT email, first_name, last_name, phone, avatar_url FROM users WHERE id = $1',
      [userId]
    );

    if (current.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const existing = current.rows[0];

    const updated = await pool.query(
      `UPDATE users
       SET email = $1,
           first_name = $2,
           last_name = $3,
           phone = $4,
           avatar_url = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, email, first_name, last_name, phone, avatar_url`,
      [
        email ?? existing.email,
        firstName ?? existing.first_name,
        lastName ?? existing.last_name,
        phone !== undefined ? phone.trim() : existing.phone,
        avatarUrl ?? existing.avatar_url,
        userId,
      ]
    );

    const user = updated.rows[0];

    const refreshed = await pool.query(
      'SELECT id, email, first_name, last_name, phone, avatar_url, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );
    req.user = refreshed.rows[0];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};