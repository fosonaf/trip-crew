import { Request, Response } from 'express';
import pool from '../config/database';

export const checkIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stepId } = req.params;
    const { memberId } = req.body;
    const checkedBy = req.user?.id;

    const existingCheckIn = await pool.query(
      'SELECT id FROM check_ins WHERE step_id = $1 AND member_id = $2',
      [stepId, memberId]
    );

    if (existingCheckIn.rows.length > 0) {
      res.status(400).json({ error: 'Already checked in' });
      return;
    }

    await pool.query(
      'INSERT INTO check_ins (step_id, member_id, checked_by) VALUES ($1, $2, $3)',
      [stepId, memberId, checkedBy]
    );

    res.status(201).json({ message: 'Check-in successful' });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
};

export const scanQRCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stepId } = req.params;
    const { qrData } = req.body;
    const checkedBy = req.user?.id;

    let parsedData;
    try {
      parsedData = JSON.parse(qrData);
    } catch (e) {
      res.status(400).json({ error: 'Invalid QR code' });
      return;
    }

    const { eventId, memberId } = parsedData;

    const stepCheck = await pool.query(
      'SELECT event_id FROM event_steps WHERE id = $1',
      [stepId]
    );

    if (stepCheck.rows.length === 0) {
      res.status(404).json({ error: 'Step not found' });
      return;
    }

    if (stepCheck.rows[0].event_id !== eventId) {
      res.status(400).json({ error: 'QR code does not match this event' });
      return;
    }

    const existingCheckIn = await pool.query(
      'SELECT id FROM check_ins WHERE step_id = $1 AND member_id = $2',
      [stepId, memberId]
    );

    if (existingCheckIn.rows.length > 0) {
      res.status(400).json({ error: 'Already checked in' });
      return;
    }

    await pool.query(
      'INSERT INTO check_ins (step_id, member_id, checked_by) VALUES ($1, $2, $3)',
      [stepId, memberId, checkedBy]
    );

    const memberInfo = await pool.query(
      `SELECT u.first_name, u.last_name 
       FROM event_members em
       JOIN users u ON em.user_id = u.id
       WHERE em.id = $1`,
      [memberId]
    );

    res.status(201).json({ 
      message: 'Check-in successful',
      member: memberInfo.rows[0]
    });
  } catch (error) {
    console.error('QR scan error:', error);
    res.status(500).json({ error: 'Failed to process QR code' });
  }
};

export const getCheckIns = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stepId } = req.params;

    const result = await pool.query(
      `SELECT ci.*, em.id as member_id, u.first_name, u.last_name, em.role
       FROM check_ins ci
       JOIN event_members em ON ci.member_id = em.id
       JOIN users u ON em.user_id = u.id
       WHERE ci.step_id = $1
       ORDER BY ci.checked_in_at DESC`,
      [stepId]
    );

    const checkIns = result.rows.map(ci => ({
      id: ci.id,
      memberId: ci.member_id,
      firstName: ci.first_name,
      lastName: ci.last_name,
      role: ci.role,
      checkedInAt: ci.checked_in_at,
    }));

    res.json(checkIns);
  } catch (error) {
    console.error('Get check-ins error:', error);
    res.status(500).json({ error: 'Failed to get check-ins' });
  }
};

export const getCheckInStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stepId } = req.params;

    const stepResult = await pool.query(
      'SELECT event_id FROM event_steps WHERE id = $1',
      [stepId]
    );

    if (stepResult.rows.length === 0) {
      res.status(404).json({ error: 'Step not found' });
      return;
    }

    const eventId = stepResult.rows[0].event_id;

    const membersResult = await pool.query(
      `SELECT em.id, em.role, u.first_name, u.last_name, u.id as user_id
       FROM event_members em
       JOIN users u ON em.user_id = u.id
       WHERE em.event_id = $1`,
      [eventId]
    );

    const checkedInResult = await pool.query(
      'SELECT member_id FROM check_ins WHERE step_id = $1',
      [stepId]
    );

    const checkedInIds = checkedInResult.rows.map(row => row.member_id);

    const status = membersResult.rows.map(member => ({
      memberId: member.id,
      userId: member.user_id,
      firstName: member.first_name,
      lastName: member.last_name,
      role: member.role,
      checkedIn: checkedInIds.includes(member.id),
    }));

    res.json({
      total: status.length,
      checkedIn: checkedInIds.length,
      pending: status.length - checkedInIds.length,
      members: status,
    });
  } catch (error) {
    console.error('Get check-in status error:', error);
    res.status(500).json({ error: 'Failed to get check-in status' });
  }
};