import { Request, Response } from 'express';
import pool from '../config/database';
import QRCode from 'qrcode';

export const createEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, startDate, endDate, location, isPaid, price } = req.body;
    const userId = req.user?.id;

    const eventResult = await pool.query(
      `INSERT INTO events (name, description, start_date, end_date, location, is_paid, price, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, description, startDate, endDate, location, isPaid, price, userId]
    );

    const event = eventResult.rows[0];

    const qrData = JSON.stringify({
      eventId: event.id,
      userId: userId,
      memberId: null,
    });
    const qrCode = await QRCode.toDataURL(qrData);

    const memberResult = await pool.query(
      `INSERT INTO event_members (event_id, user_id, role, payment_status, qr_code)
       VALUES ($1, $2, 'organizer', 'paid', $3)
       RETURNING id`,
      [event.id, userId, qrCode]
    );

    const updatedQrData = JSON.stringify({
      eventId: event.id,
      userId: userId,
      memberId: memberResult.rows[0].id,
    });
    const updatedQrCode = await QRCode.toDataURL(updatedQrData);

    await pool.query(
      'UPDATE event_members SET qr_code = $1 WHERE id = $2',
      [updatedQrCode, memberResult.rows[0].id]
    );

    res.status(201).json({
      id: event.id,
      name: event.name,
      description: event.description,
      startDate: event.start_date,
      endDate: event.end_date,
      location: event.location,
      isPaid: event.is_paid,
      price: event.price,
      createdBy: event.created_by,
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
};

export const getEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(
      `SELECT DISTINCT e.*, em.role, em.payment_status
       FROM events e
       INNER JOIN event_members em ON e.id = em.event_id
       WHERE em.user_id = $1
       ORDER BY e.created_at DESC`,
      [userId]
    );

    const events = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      location: row.location,
      isPaid: row.is_paid,
      price: row.price,
      role: row.role,
      paymentStatus: row.payment_status,
    }));

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
};

export const getEventById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;

    const memberCheck = await pool.query(
      'SELECT id FROM event_members WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );

    if (memberCheck.rows.length === 0) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const eventResult = await pool.query(
      `SELECT e.*, u.first_name, u.last_name
       FROM events e
       JOIN users u ON e.created_by = u.id
       WHERE e.id = $1`,
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const event = eventResult.rows[0];

    const membersResult = await pool.query(
      `SELECT em.id, em.role, em.payment_status,
              u.id as user_id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url
       FROM event_members em
       JOIN users u ON em.user_id = u.id
       WHERE em.event_id = $1`,
      [eventId]
    );

    const stepsResult = await pool.query(
      `SELECT * FROM event_steps WHERE event_id = $1 ORDER BY scheduled_time`,
      [eventId]
    );

    res.json({
      id: event.id,
      name: event.name,
      description: event.description,
      startDate: event.start_date,
      endDate: event.end_date,
      location: event.location,
      isPaid: event.is_paid,
      price: event.price,
      createdBy: {
        id: event.created_by,
        firstName: event.first_name,
        lastName: event.last_name,
      },
      members: membersResult.rows.map(m => ({
        id: m.id,
        userId: m.user_id,
        firstName: m.first_name,
        lastName: m.last_name,
        email: m.email,
        phone: m.phone,
        role: m.role,
        paymentStatus: m.payment_status,
        avatarUrl: m.avatar_url,
      })),
      steps: stepsResult.rows.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        location: s.location,
        scheduledTime: s.scheduled_time,
        alertBeforeMinutes: s.alert_before_minutes,
      })),
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to get event' });
  }
};

export const updateEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { name, description, startDate, endDate, location, isPaid, price } = req.body;

    const result = await pool.query(
      `UPDATE events 
       SET name = $1, description = $2, start_date = $3, end_date = $4, 
           location = $5, is_paid = $6, price = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [name, description, startDate, endDate, location, isPaid, price, eventId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json({ message: 'Event updated successfully' });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
};

export const deleteEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
};