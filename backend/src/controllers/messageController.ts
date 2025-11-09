import { Request, Response } from 'express';
import pool from '../config/database';

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT m.*, u.first_name, u.last_name 
       FROM messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.event_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [eventId, limit, offset]
    );

    const messages = result.rows.map(msg => ({
      id: msg.id,
      content: msg.content,
      createdAt: msg.created_at,
      user: {
        id: msg.user_id,
        firstName: msg.first_name,
        lastName: msg.last_name,
      },
    }));

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

export const createMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    const result = await pool.query(
      `INSERT INTO messages (event_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [eventId, userId, content]
    );

    const message = result.rows[0];

    res.status(201).json({
      id: message.id,
      content: message.content,
      createdAt: message.created_at,
      userId: message.user_id,
    });
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
};