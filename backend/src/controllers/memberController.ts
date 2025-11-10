import { Request, Response } from 'express';
import QRCode from 'qrcode';
import prisma from '../config/prisma';

const parseId = (value: string, label: string): number => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    throw new Error(`${label} invalide`);
  }
  return numeric;
};

export const joinEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let numericEventId: number;
    try {
      numericEventId = parseId(eventId, 'Identifiant événement');
    } catch {
      res.status(400).json({ error: 'Identifiant événement invalide' });
      return;
    }

    const event = await prisma.event.findUnique({
      where: { id: numericEventId },
      select: { id: true },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const existingMembership = await prisma.eventMember.findFirst({
      where: { eventId: numericEventId, userId },
      select: { id: true, status: true },
    });

    if (existingMembership) {
      if (existingMembership.status === 'pending') {
        await activatePendingMember(existingMembership.id, numericEventId, userId);
        res
          .status(200)
          .json({ message: 'Invitation accepted', memberId: existingMembership.id });
        return;
      }

      res.status(400).json({ error: 'Already a member of this event' });
      return;
    }

    const memberId = await createActiveMember(numericEventId, userId);
    res.status(201).json({ message: 'Successfully joined event', memberId });
  } catch (error) {
    console.error('Join event error:', error);
    res.status(500).json({ error: 'Failed to join event' });
  }
};

export const updateMemberRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, memberId } = req.params;
    const { role } = req.body as { role?: string };

    if (!role || !['organizer', 'member'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const result = await prisma.eventMember.updateMany({
      where: {
        id: Number(memberId),
        eventId: Number(eventId),
      },
      data: { role },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    res.json({ message: 'Member role updated successfully' });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
};

export const updatePaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, memberId } = req.params;
    const { paymentStatus } = req.body as { paymentStatus?: string };

    if (!paymentStatus || !['pending', 'paid', 'refunded'].includes(paymentStatus)) {
      res.status(400).json({ error: 'Invalid payment status' });
      return;
    }

    const result = await prisma.eventMember.updateMany({
      where: {
        id: Number(memberId),
        eventId: Number(eventId),
      },
      data: { paymentStatus },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    res.json({ message: 'Payment status updated successfully' });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, memberId } = req.params;
    const membership = await prisma.eventMember.findFirst({
      where: {
        id: Number(memberId),
        eventId: Number(eventId),
      },
      select: {
        id: true,
        role: true,
        status: true,
        eventId: true,
      },
    });

    if (!membership) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    if (membership.status === 'pending') {
      await prisma.eventMember.delete({ where: { id: membership.id } });
      res.json({ message: 'Invitation removed successfully' });
      return;
    }

    if (membership.role === 'organizer') {
      const organizerCount = await prisma.eventMember.count({
        where: {
          eventId: membership.eventId,
          role: 'organizer',
          status: 'active',
        },
      });

      if (organizerCount <= 1) {
        res.status(400).json({ error: 'Impossible de retirer le dernier organisateur.' });
        return;
      }
    }

    await prisma.eventMember.delete({ where: { id: membership.id } });
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

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const membership = await prisma.eventMember.findFirst({
      where: { eventId: Number(eventId), userId },
      select: { qrCode: true },
    });

    if (!membership) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    res.json({ qrCode: membership.qrCode });
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

    const event = await prisma.event.findUnique({
      where: { id: Number(eventId) },
      select: { id: true },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const invitedUser = await prisma.user.findUnique({
      where: { phone: phone.trim() },
      select: { id: true },
    });

    if (!invitedUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (invitedUser.id === organizerId) {
      res.status(400).json({ error: 'You are already part of this event' });
      return;
    }

    const existingMembership = await prisma.eventMember.findFirst({
      where: { eventId: Number(eventId), userId: invitedUser.id },
      select: { id: true, status: true },
    });

    if (existingMembership) {
      if (existingMembership.status === 'pending') {
        res
          .status(200)
          .json({ message: 'Invitation already pending', memberId: existingMembership.id });
        return;
      }

      res.status(400).json({ error: 'User already a member of this event' });
      return;
    }

    const member = await prisma.eventMember.create({
      data: {
        eventId: Number(eventId),
        userId: invitedUser.id,
        role: 'member',
        paymentStatus: 'pending',
        status: 'pending',
        invitedBy: organizerId,
      },
      select: { id: true },
    });

    res.status(201).json({ message: 'Invitation sent successfully', memberId: member.id });
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

    const numericEventId = Number(eventId);

    const event = await prisma.event.findUnique({
      where: { id: numericEventId },
      select: { id: true },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const existingMembership = await prisma.eventMember.findFirst({
      where: { eventId: numericEventId, userId },
      select: { status: true },
    });

    if (existingMembership) {
      if (existingMembership.status === 'pending') {
        res
          .status(400)
          .json({ error: 'Une invitation est déjà en attente pour cet évènement.' });
        return;
      }

      res.status(400).json({ error: 'Tu fais déjà partie de cet évènement.' });
      return;
    }

    const existingRequest = await prisma.eventJoinRequest.findFirst({
      where: { eventId: numericEventId, userId },
      select: { id: true, status: true },
    });

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        res.status(200).json({
          message: 'Ta demande est déjà en attente de validation.',
          requestId: existingRequest.id,
        });
        return;
      }

      const updated = await prisma.eventJoinRequest.update({
        where: { id: existingRequest.id },
        data: { status: 'pending' },
        select: { id: true },
      });

      res.status(200).json({
        message: 'Ta demande a été renvoyée aux organisateurs.',
        requestId: updated.id,
      });
      return;
    }

    const request = await prisma.eventJoinRequest.create({
      data: {
        eventId: numericEventId,
        userId,
        status: 'pending',
      },
      select: { id: true },
    });

    res.status(201).json({
      message: 'Ta demande a été envoyée aux organisateurs.',
      requestId: request.id,
    });
  } catch (error) {
    console.error('Request join error:', error);
    res.status(500).json({ error: 'Failed to submit join request' });
  }
};

export const listEventJoinRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;

    const requests = await prisma.eventJoinRequest.findMany({
      where: {
        eventId: Number(eventId),
        status: 'pending',
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
      },
    });

    type JoinRequestWithUser = (typeof requests)[number];

    res.json(
      requests.map((request: JoinRequestWithUser) => ({
        id: request.id,
        userId: request.user.id,
        firstName: request.user.firstName,
        lastName: request.user.lastName,
        email: request.user.email,
        phone: request.user.phone,
        avatarUrl: request.user.avatarUrl,
        requestedAt: request.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    console.error('List join requests error:', error);
    res.status(500).json({ error: 'Failed to list join requests' });
  }
};

export const listUserJoinRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const requests = await prisma.eventJoinRequest.findMany({
      where: {
        userId,
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        event: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(
      requests.map((request) => ({
        id: request.id,
        eventId: request.event.id,
        eventName: request.event.name,
        requestedAt: request.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    console.error('List user join requests error:', error);
    res.status(500).json({ error: 'Failed to list join requests' });
  }
};

export const cancelJoinRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { requestId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const updated = await prisma.eventJoinRequest.updateMany({
      where: {
        id: Number(requestId),
        userId,
        status: 'pending',
      },
      data: {
        status: 'cancelled',
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: 'Demande introuvable ou déjà traitée.' });
      return;
    }

    res.json({ message: 'Demande annulée.' });
  } catch (error) {
    console.error('Cancel join request error:', error);
    res.status(500).json({ error: 'Failed to cancel join request' });
  }
};

export const acceptJoinRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, requestId } = req.params;
    const numericEventId = Number(eventId);
    const numericRequestId = Number(requestId);

    const request = await prisma.eventJoinRequest.findUnique({
      where: { id: numericRequestId },
      select: { id: true, eventId: true, userId: true, status: true },
    });

    if (!request || request.eventId !== numericEventId) {
      res.status(404).json({ error: 'Demande introuvable.' });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ error: 'Cette demande a déjà été traitée.' });
      return;
    }

    const existingMembership = await prisma.eventMember.findFirst({
      where: {
        eventId: numericEventId,
        userId: request.userId,
      },
      select: { id: true, status: true },
    });

    let memberId: number | null = null;
    let alreadyActive = false;

    if (existingMembership) {
      if (existingMembership.status === 'active') {
        alreadyActive = true;
      } else {
        await activatePendingMember(existingMembership.id, numericEventId, request.userId);
        memberId = existingMembership.id;
      }
    } else {
      memberId = await createActiveMember(numericEventId, request.userId);
    }

    await prisma.eventJoinRequest.update({
      where: { id: request.id },
      data: { status: 'accepted' },
    });

    if (alreadyActive) {
      res.json({ message: 'Le membre participe déjà à cet évènement.' });
      return;
    }

    const member = await prisma.eventMember.findUnique({
      where: { id: memberId! },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!member) {
      res.status(500).json({ error: 'Failed to retrieve member information' });
      return;
    }

    res.json({
      message: 'Demande acceptée.',
      member: {
        id: member.id,
        userId: member.user.id,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        email: member.user.email,
        phone: member.user.phone,
        role: member.role,
        paymentStatus: member.paymentStatus,
        status: member.status,
        invitedBy: member.invitedBy,
        avatarUrl: member.user.avatarUrl,
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

    const updated = await prisma.eventJoinRequest.updateMany({
      where: {
        id: Number(requestId),
        eventId: Number(eventId),
        status: 'pending',
      },
      data: { status: 'declined' },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: 'Demande introuvable.' });
      return;
    }

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

    const invitations = await prisma.eventMember.findMany({
      where: {
        userId,
        status: 'pending',
      },
      orderBy: { joinedAt: 'desc' },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startDate: true,
          },
        },
        inviter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    type PendingInvitationWithRelations = (typeof invitations)[number];

    res.json(
      invitations.map((invitation: PendingInvitationWithRelations) => ({
        memberId: invitation.id,
        eventId: invitation.event.id,
        eventName: invitation.event.name,
        startDate: invitation.event.startDate
          ? invitation.event.startDate.toISOString()
          : null,
        invitedBy: invitation.invitedBy ?? null,
        inviter: invitation.inviter
          ? `${invitation.inviter.firstName} ${invitation.inviter.lastName ?? ''}`.trim()
          : null,
      })),
    );
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

    const membership = await prisma.eventMember.findFirst({
      where: { id: Number(memberId), userId },
      select: { id: true, status: true, eventId: true },
    });

    if (!membership) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    if (membership.status !== 'pending') {
      res.status(400).json({ error: 'Invitation already processed' });
      return;
    }

    await activatePendingMember(membership.id, membership.eventId, userId);

    res.json({
      message: 'Invitation accepted',
      eventId: membership.eventId,
    });
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

    const deleted = await prisma.eventMember.deleteMany({
      where: {
        id: Number(memberId),
        userId,
        status: 'pending',
      },
    });

    if (deleted.count === 0) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    res.json({ message: 'Invitation declined' });
  } catch (error) {
    console.error('Decline invitation error:', error);
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
};

export const removePendingInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, memberId } = req.params;

    const deleted = await prisma.eventMember.deleteMany({
      where: {
        id: Number(memberId),
        eventId: Number(eventId),
        status: 'pending',
      },
    });

    if (deleted.count === 0) {
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

    const membership = await prisma.eventMember.findFirst({
      where: {
        eventId: Number(eventId),
        userId,
        status: 'active',
      },
      select: { id: true, role: true, eventId: true },
    });

    if (!membership) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    if (membership.role === 'organizer') {
      const organizerCount = await prisma.eventMember.count({
        where: {
          eventId: membership.eventId,
          role: 'organizer',
          status: 'active',
        },
      });

      if (organizerCount <= 1) {
        res
          .status(400)
          .json({ error: 'Impossible de quitter : tu es le dernier organisateur.' });
        return;
      }
    }

    await prisma.eventMember.delete({ where: { id: membership.id } });
    res.json({ message: 'Event left successfully' });
  } catch (error) {
    console.error('Leave event error:', error);
    res.status(500).json({ error: 'Failed to leave event' });
  }
};

const createActiveMember = async (eventId: number, userId: number): Promise<number> => {
  const member = await prisma.eventMember.create({
    data: {
      eventId,
      userId,
      role: 'member',
      paymentStatus: 'pending',
      status: 'active',
      qrCode: null,
    },
    select: { id: true },
  });

  await updateMemberQRCode(member.id, eventId, userId);
  return member.id;
};

const activatePendingMember = async (
  memberId: number,
  eventId: number,
  userId: number,
): Promise<void> => {
  await updateMemberQRCode(memberId, eventId, userId);
  await prisma.eventMember.update({
    where: { id: memberId },
    data: { status: 'active' },
  });
};

const updateMemberQRCode = async (
  memberId: number,
  eventId: number,
  userId: number,
): Promise<void> => {
  const updatedQrData = JSON.stringify({ eventId, userId, memberId });
  const updatedQrCode = await QRCode.toDataURL(updatedQrData);

  await prisma.eventMember.update({
    where: { id: memberId },
    data: { qrCode: updatedQrCode },
  });
};
