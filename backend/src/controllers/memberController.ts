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
      'SELECT id, status FROM event_members WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );

    if (memberCheck.rows.length > 0) {
      const existing = memberCheck.rows[0];
      if (existing.status === 'pending') {
        await activatePendingMember(existing.id, Number(eventId), userId!);
        res.status(200).json({ message: 'Invitation accepted', memberId: existing.id });
        return;
      }

      res.status(400).json({ error: 'Already a member of this event' });
      return;
    }

    const memberId = await createActiveMember(Number(eventId), userId!);

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
    const membershipResult = await pool.query(
      `SELECT role, status FROM event_members WHERE id = $1 AND event_id = $2`,
      [memberId, eventId]
    );

    if (membershipResult.rows.length === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const membership = membershipResult.rows[0];

    if (membership.status === 'pending') {
      await pool.query('DELETE FROM event_members WHERE id = $1', [memberId]);
      res.json({ message: 'Invitation removed successfully' });
      return;
    }

    if (membership.role === 'organizer') {
      const organizerCountResult = await pool.query(
        `SELECT COUNT(*) FROM event_members 
         WHERE event_id = $1 AND role = 'organizer' AND status = 'active'`,
        [eventId]
      );

      const organizerCount = Number(organizerCountResult.rows[0].count ?? 0);
      if (organizerCount <= 1) {
        res.status(400).json({ error: 'Impossible de retirer le dernier organisateur.' });
        return;
      }
    }

    await pool.query('DELETE FROM event_members WHERE id = $1', [memberId]);

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

export const inviteMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { phone } = req.body as { phone?: string };
    const organizerId = req.user?.id;

    if (!organizerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!phone || !phone.trim()) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    const eventResult = await pool.query(
      'SELECT id FROM events WHERE id = $1',
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE phone = $1',
      [phone.trim()]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const invitedUserId = userResult.rows[0].id as number;

    if (invitedUserId === organizerId) {
      res.status(400).json({ error: 'You are already part of this event' });
      return;
    }

    const existing = await pool.query(
      'SELECT id, status FROM event_members WHERE event_id = $1 AND user_id = $2',
      [eventId, invitedUserId]
    );

    if (existing.rows.length > 0) {
      const member = existing.rows[0];
      if (member.status === 'pending') {
        res.status(200).json({ message: 'Invitation already pending', memberId: member.id });
        return;
      }

      res.status(400).json({ error: 'User already a member of this event' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO event_members (event_id, user_id, role, payment_status, status, invited_by)
       VALUES ($1, $2, 'member', 'pending', 'pending', $3)
       RETURNING id`,
      [eventId, invitedUserId, organizerId]
    );

    res.status(201).json({ message: 'Invitation sent successfully', memberId: result.rows[0].id });
  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({ error: 'Failed to invite member' });
  }
};

export const requestEventJoin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const eventResult = await pool.query('SELECT id FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const membershipResult = await pool.query(
      'SELECT status FROM event_members WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );

    if (membershipResult.rows.length > 0) {
      const membership = membershipResult.rows[0];
      if (membership.status === 'pending') {
        res.status(400).json({ error: 'Une invitation est déjà en attente pour cet évènement.' });
        return;
      }

      res.status(400).json({ error: 'Tu fais déjà partie de cet évènement.' });
      return;
    }

    const existingRequestResult = await pool.query(
      'SELECT id, status FROM event_join_requests WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );

    if (existingRequestResult.rows.length > 0) {
      const request = existingRequestResult.rows[0];

      if (request.status === 'pending') {
        res.status(200).json({ message: 'Ta demande est déjà en attente de validation.', requestId: Number(request.id) });
        return;
      }

      await pool.query(
        `UPDATE event_join_requests 
         SET status = 'pending', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [request.id]
      );

      res.status(200).json({ message: 'Ta demande a été renvoyée aux organisateurs.', requestId: Number(request.id) });
      return;
    }

    const result = await pool.query(
      `INSERT INTO event_join_requests (event_id, user_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING id`,
      [eventId, userId]
    );

    res.status(201).json({ message: 'Ta demande a été envoyée aux organisateurs.', requestId: Number(result.rows[0].id) });
  } catch (error) {
    console.error('Request join error:', error);
    res.status(500).json({ error: 'Failed to submit join request' });
  }
};

export const listEventJoinRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;

    const result = await pool.query(
      `SELECT jr.id, jr.created_at, u.id as user_id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url
       FROM event_join_requests jr
       JOIN users u ON jr.user_id = u.id
       WHERE jr.event_id = $1 AND jr.status = 'pending'
       ORDER BY jr.created_at ASC`,
      [eventId]
    );

    const requests = result.rows.map((row) => ({
      id: Number(row.id),
      userId: Number(row.user_id),
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      email: row.email as string | null,
      phone: row.phone as string | null,
      avatarUrl: row.avatar_url as string | null,
      requestedAt: new Date(row.created_at).toISOString(),
    }));

    res.json(requests);
  } catch (error) {
    console.error('List join requests error:', error);
    res.status(500).json({ error: 'Failed to list join requests' });
  }
};

export const acceptJoinRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, requestId } = req.params;

    const requestResult = await pool.query(
      'SELECT id, user_id, status FROM event_join_requests WHERE id = $1 AND event_id = $2',
      [requestId, eventId]
    );

    if (requestResult.rows.length === 0) {
      res.status(404).json({ error: 'Demande introuvable.' });
      return;
    }

    const request = requestResult.rows[0];

    if (request.status !== 'pending') {
      res.status(400).json({ error: 'Cette demande a déjà été traitée.' });
      return;
    }

    const requesterId = Number(request.user_id);

    const existingMembership = await pool.query(
      'SELECT id, status FROM event_members WHERE event_id = $1 AND user_id = $2',
      [eventId, requesterId]
    );

    let memberId: number;

    if (existingMembership.rows.length > 0) {
      const membership = existingMembership.rows[0];
      if (membership.status === 'active') {
        await pool.query(
          `UPDATE event_join_requests 
           SET status = 'accepted', updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [requestId]
        );
        res.json({ message: 'Le membre participe déjà à cet évènement.' });
        return;
      }

      await activatePendingMember(Number(membership.id), Number(eventId), requesterId);
      memberId = Number(membership.id);
    } else {
      memberId = await createActiveMember(Number(eventId), requesterId);
    }

    await pool.query(
      `UPDATE event_join_requests 
       SET status = 'accepted', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [requestId]
    );

    const memberResult = await pool.query(
      `SELECT em.id, em.role, em.payment_status, em.status, em.invited_by,
              u.id as user_id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url
       FROM event_members em
       JOIN users u ON em.user_id = u.id
       WHERE em.id = $1`,
      [memberId]
    );

    if (memberResult.rows.length === 0) {
      res.status(500).json({ error: 'Failed to retrieve member information' });
      return;
    }

    const member = memberResult.rows[0];

    res.json({
      message: 'Demande acceptée.',
      member: {
        id: Number(member.id),
        userId: Number(member.user_id),
        firstName: member.first_name as string,
        lastName: member.last_name as string,
        email: member.email as string | null,
        phone: member.phone as string | null,
        role: member.role as string,
        paymentStatus: member.payment_status,
        status: member.status as string,
        invitedBy: member.invited_by ? Number(member.invited_by) : null,
        avatarUrl: member.avatar_url as string | null,
      },
    });
  } catch (error) {
    console.error('Accept join request error:', error);
    res.status(500).json({ error: 'Failed to accept join request' });
  }
};

export const declineJoinRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, requestId } = req.params;

    const requestResult = await pool.query(
      'SELECT status FROM event_join_requests WHERE id = $1 AND event_id = $2',
      [requestId, eventId]
    );

    if (requestResult.rows.length === 0) {
      res.status(404).json({ error: 'Demande introuvable.' });
      return;
    }

    if (requestResult.rows[0].status !== 'pending') {
      res.status(400).json({ error: 'Cette demande a déjà été traitée.' });
      return;
    }

    await pool.query(
      `UPDATE event_join_requests 
       SET status = 'declined', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [requestId]
    );

    res.json({ message: 'Demande refusée.' });
  } catch (error) {
    console.error('Decline join request error:', error);
    res.status(500).json({ error: 'Failed to decline join request' });
  }
};

export const listPendingInvitations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const result = await pool.query(
      `SELECT 
         em.id,
         em.event_id,
         em.invited_by,
         e.name AS event_name,
         e.start_date,
         u.first_name AS inviter_first_name,
         u.last_name AS inviter_last_name
       FROM event_members em
       JOIN events e ON em.event_id = e.id
       LEFT JOIN users u ON em.invited_by = u.id
       WHERE em.user_id = $1 AND em.status = 'pending'
       ORDER BY em.joined_at DESC`,
      [userId]
    );

    const invitations = result.rows.map((row) => ({
      memberId: Number(row.id),
      eventId: Number(row.event_id),
      eventName: row.event_name as string,
      startDate: row.start_date ? new Date(row.start_date).toISOString() : null,
      invitedBy: row.invited_by ? Number(row.invited_by) : null,
      inviter: row.inviter_first_name
        ? `${row.inviter_first_name} ${row.inviter_last_name ?? ''}`.trim()
        : null,
    }));

    res.json(invitations);
  } catch (error) {
    console.error('List pending invitations error:', error);
    res.status(500).json({ error: 'Failed to list invitations' });
  }
};

export const acceptInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const memberResult = await pool.query(
      'SELECT event_id, status FROM event_members WHERE id = $1 AND user_id = $2',
      [memberId, userId]
    );

    if (memberResult.rows.length === 0) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    const member = memberResult.rows[0];

    if (member.status !== 'pending') {
      res.status(400).json({ error: 'Invitation already processed' });
      return;
    }

    await activatePendingMember(Number(memberId), Number(member.event_id), userId);

    res.json({ message: 'Invitation accepted', eventId: Number(member.event_id) });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
};

export const declineInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const memberResult = await pool.query(
      "SELECT status FROM event_members WHERE id = $1 AND user_id = $2",
      [memberId, userId]
    );

    if (memberResult.rows.length === 0) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    if (memberResult.rows[0].status !== 'pending') {
      res.status(400).json({ error: 'Invitation already processed' });
      return;
    }

    await pool.query(
      "DELETE FROM event_members WHERE id = $1 AND user_id = $2 AND status = 'pending'",
      [memberId, userId]
    );

    res.json({ message: 'Invitation declined' });
  } catch (error) {
    console.error('Decline invitation error:', error);
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
};

const createActiveMember = async (eventId: number, userId: number): Promise<number> => {
  const qrData = JSON.stringify({
    eventId,
    userId,
    memberId: null,
  });
  const qrCode = await QRCode.toDataURL(qrData);

  const result = await pool.query(
    `INSERT INTO event_members (event_id, user_id, role, payment_status, status, qr_code)
     VALUES ($1, $2, 'member', 'pending', 'active', $3)
     RETURNING id`,
    [eventId, userId, qrCode]
  );

  const memberId = Number(result.rows[0].id);
  await updateMemberQRCode(memberId, eventId, userId);
  return memberId;
};

const activatePendingMember = async (memberId: number, eventId: number, userId: number): Promise<void> => {
  await updateMemberQRCode(memberId, eventId, userId);
  await pool.query(
    `UPDATE event_members 
     SET status = 'active', updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [memberId]
  );
};

const updateMemberQRCode = async (memberId: number, eventId: number, userId: number): Promise<void> => {
  const updatedQrData = JSON.stringify({
    eventId,
    userId,
    memberId,
  });
  const updatedQrCode = await QRCode.toDataURL(updatedQrData);

  await pool.query(
    'UPDATE event_members SET qr_code = $1 WHERE id = $2',
    [updatedQrCode, memberId]
  );
};

export const removePendingInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, memberId } = req.params;

    const result = await pool.query(
      `DELETE FROM event_members 
       WHERE id = $1 AND event_id = $2 AND status = 'pending'`,
      [memberId, eventId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Pending invitation not found' });
      return;
    }

    res.json({ message: 'Invitation removed successfully' });
  } catch (error) {
    console.error('Remove invitation error:', error);
    res.status(500).json({ error: 'Failed to remove invitation' });
  }
};

export const leaveEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const membershipResult = await pool.query(
      `SELECT id, role FROM event_members 
       WHERE event_id = $1 AND user_id = $2 AND status = 'active'`,
      [eventId, userId]
    );

    if (membershipResult.rows.length === 0) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    const membership = membershipResult.rows[0];

    if (membership.role === 'organizer') {
      const organizerCountResult = await pool.query(
        `SELECT COUNT(*) FROM event_members 
         WHERE event_id = $1 AND role = 'organizer' AND status = 'active'`,
        [eventId]
      );

      const organizerCount = Number(organizerCountResult.rows[0].count ?? 0);
      if (organizerCount <= 1) {
        res.status(400).json({ error: 'Impossible de quitter : tu es le dernier organisateur.' });
        return;
      }
    }

    await pool.query('DELETE FROM event_members WHERE id = $1', [membership.id]);

    res.json({ message: 'Event left successfully' });
  } catch (error) {
    console.error('Leave event error:', error);
    res.status(500).json({ error: 'Failed to leave event' });
  }
};