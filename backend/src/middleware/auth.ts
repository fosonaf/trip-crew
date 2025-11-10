import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt';
import pool from '../config/database';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const result = await pool.query(
      'SELECT id, email, first_name, last_name, phone, avatar_url FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export const isEventOrganizer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const result = await pool.query(
      `SELECT role FROM event_members 
       WHERE event_id = $1 AND user_id = $2 AND role = 'organizer'`,
      [eventId, userId]
    );

    if (result.rows.length === 0) {
      res.status(403).json({ error: 'Access denied. Organizer role required.' });
      return;
    }

    next();
  } catch (error) {
    console.error('Organizer check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};