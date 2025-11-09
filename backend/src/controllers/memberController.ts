import { Request, Response } from 'express';
import pool from '../config/database';
import QRCode from 'qrcode';

export const joinEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;

    const eventResult = await pool.query(
      'SELECT * FROM events WHERE id = $1',
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const memberCheck = await pool.query(
      'SELECT id FROM event_members WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );

    if (memberCheck.rows.length > 0) {
      res.status(400).json({ error: 'Already a member of this event' });
      return;
    }

    const qrData = JSON.stringify({
      eventId: eventId,
      userId: userId,
      memberId: null,
    });
    const qrCode = await QRCode.toDataURL(qrData);

    const result = await pool.query(
      `INSERT INTO event_members (event_id, user_id, role, qr_code)
       VALUES ($1, $2, 'member', $3)
       RETURNING id`,
      [eventId, userId, qrCode]
    );

    const memberId = result.rows[0].id;
    const updatedQrData = JSON.stringify({
      eventId: eventId,
      userId: userId,
      memberId: memberId,
    });
    const updatedQrCode = await QRCode.toDataURL(updatedQrData);

    await pool.query(
      'UPDATE event_members SET qr_code = $1 WHERE id = $2',
      [updatedQrCode, memberId]
    );

    res.status(201).json({ message: 'Successfully joined event', memberId });
  } catch (error) {
    console.error('Join event error:', error);
    res.status(500).json({ error: 'Failed to join event' });
  }
};

export const updateMemberRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, memberId } = req.params;
    const { role } = req.body;

    if (!['organizer', 'member'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    await pool.query(
      'UPDATE event_members SET role = $1 WHERE id = $2 AND event_id = $3',
      [role, memberId, eventId]
    );

    res.json({ message: 'Member role updated successfully' });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
};

export const updatePaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, memberId } = req.params;
    const { paymentStatus } = req.body;

    if (!['pending', 'paid', 'refunded'].includes(paymentStatus)) {
      res.status(400).json({ error: 'Invalid payment status' });
      return;
    }

    await pool.query(
      'UPDATE event_members SET payment_status = $1 WHERE id = $2 AND event_id = $3',
      [paymentStatus, memberId, eventId]
    );

    res.json({ message: 'Payment status updated successfully' });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, memberId } = req.params;
    await pool.query(
      'DELETE FROM event_members WHERE id = $1 AND event_id = $2',
      [memberId, eventId]
    );
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
};

export const getMemberQRCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;

    const result = await pool.query(
      'SELECT qr_code FROM event_members WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    res.json({ qrCode: result.rows[0].qr_code });
  } catch (error) {
    console.error('Get QR code error:', error);
    res.status(500).json({ error: 'Failed to get QR code' });
  }
};