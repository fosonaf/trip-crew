import { Request, Response } from 'express';
import QRCode from 'qrcode';
import prisma from '../config/prisma';

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return Boolean(value);
};

export const createEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, startDate, endDate, location, isPaid, price } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const normalizedPrice =
      price === undefined || price === null || Number.isNaN(Number(price))
        ? null
        : Number(price);

    const event = await prisma.event.create({
      data: {
        name,
        description: description ?? null,
        startDate: parseDate(startDate),
        endDate: parseDate(endDate),
        location: location ?? null,
        isPaid: toBoolean(isPaid),
        price: normalizedPrice,
        createdBy: userId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        startDate: true,
        endDate: true,
        location: true,
        isPaid: true,
        price: true,
        createdBy: true,
      },
    });

    const qrData = JSON.stringify({
      eventId: event.id,
      userId,
      memberId: null,
    });
    const qrCode = await QRCode.toDataURL(qrData);

    const member = await prisma.eventMember.create({
      data: {
        eventId: event.id,
        userId,
        role: 'organizer',
        paymentStatus: 'paid',
        status: 'active',
        qrCode,
      },
      select: { id: true },
    });

    const updatedQrData = JSON.stringify({
      eventId: event.id,
      userId,
      memberId: member.id,
    });
    const updatedQrCode = await QRCode.toDataURL(updatedQrData);

    await prisma.eventMember.update({
      where: { id: member.id },
      data: { qrCode: updatedQrCode },
    });

    res.status(201).json({
      id: event.id,
      name: event.name,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      isPaid: event.isPaid,
      price: event.price ? Number(event.price) : null,
      createdBy: event.createdBy,
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
};

export const getEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.json([]);
      return;
    }

    const memberships = await prisma.eventMember.findMany({
      where: {
        userId,
        status: 'active',
      },
      include: {
        event: true,
      },
      orderBy: {
        event: { createdAt: 'desc' },
      },
    });

    const eventIds = memberships.map((membership) => membership.eventId);

    const organizerGroups =
      eventIds.length === 0
        ? []
        : await prisma.eventMember.groupBy({
            by: ['eventId'],
            where: {
              eventId: { in: eventIds },
              role: 'organizer',
              status: 'active',
            },
            _count: { eventId: true },
          });

    type OrganizerGroup = (typeof organizerGroups)[number];
    const organizerCountMap = new Map<number, number>();
    organizerGroups.forEach((group: OrganizerGroup) => {
      organizerCountMap.set(group.eventId, group._count.eventId);
    });

    type MembershipWithEvent = (typeof memberships)[number];

    const events = memberships.map((membership: MembershipWithEvent) => ({
      id: membership.event.id,
      name: membership.event.name,
      description: membership.event.description,
      startDate: membership.event.startDate,
      endDate: membership.event.endDate,
      location: membership.event.location,
      isPaid: membership.event.isPaid,
      price: membership.event.price ? Number(membership.event.price) : null,
      role: membership.role,
      paymentStatus: membership.paymentStatus,
      status: membership.status,
      memberId: membership.id,
      organizerCount: organizerCountMap.get(membership.eventId) ?? 0,
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

    const membership = await prisma.eventMember.findFirst({
      where: {
        eventId: Number(eventId),
        userId,
        status: 'active',
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!membership) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const isOrganizer = membership.role === 'organizer';

    const event = await prisma.event.findUnique({
      where: { id: Number(eventId) },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        members: {
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
        },
        steps: {
          orderBy: { scheduledTime: 'asc' },
        },
      },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    let joinRequests: Array<{
      id: number;
      userId: number;
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
      avatarUrl: string | null;
      requestedAt: string;
    }> = [];

    if (isOrganizer) {
      const pendingRequests = await prisma.eventJoinRequest.findMany({
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

      type PendingRequest = (typeof pendingRequests)[number];
      joinRequests = pendingRequests.map((request: PendingRequest) => ({
        id: request.id,
        userId: request.user.id,
        firstName: request.user.firstName,
        lastName: request.user.lastName,
        email: request.user.email,
        phone: request.user.phone,
        avatarUrl: request.user.avatarUrl,
        requestedAt: request.createdAt.toISOString(),
      }));
    }

    type EventMemberWithUser = (typeof event.members)[number];
    const members = event.members.map((member: EventMemberWithUser) => ({
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
    }));

    type EventStepData = (typeof event.steps)[number];
    const steps = event.steps.map((step: EventStepData) => ({
      id: step.id,
      name: step.name,
      description: step.description,
      location: step.location,
      scheduledTime: step.scheduledTime,
      alertBeforeMinutes: step.alertBeforeMinutes,
    }));

    res.json({
      id: event.id,
      name: event.name,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      isPaid: event.isPaid,
      price: event.price ? Number(event.price) : null,
      createdBy: {
        id: event.creator.id,
        firstName: event.creator.firstName,
        lastName: event.creator.lastName,
      },
      members,
      steps,
      joinRequests,
      joinRequestCount: joinRequests.length,
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

    const normalizedPrice =
      price === undefined || price === null || Number.isNaN(Number(price))
        ? null
        : Number(price);

    const updated = await prisma.event.update({
      where: { id: Number(eventId) },
      data: {
        name,
        description: description ?? null,
        startDate: parseDate(startDate),
        endDate: parseDate(endDate),
        location: location ?? null,
        isPaid: toBoolean(isPaid),
        price: normalizedPrice,
      },
      select: { id: true },
    }).catch(() => null);

    if (!updated) {
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
    await prisma.event.delete({
      where: { id: Number(eventId) },
    });
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
};