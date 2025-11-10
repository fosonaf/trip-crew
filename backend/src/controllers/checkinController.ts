import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const checkIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stepId } = req.params;
    const { memberId } = req.body as { memberId?: number };
    const checkedBy = req.user?.id ?? null;

    if (!memberId) {
      res.status(400).json({ error: 'Member ID is required' });
      return;
    }

    const existing = await prisma.checkIn.findFirst({
      where: { stepId: Number(stepId), memberId: Number(memberId) },
      select: { id: true },
    });

    if (existing) {
      res.status(400).json({ error: 'Already checked in' });
      return;
    }

    await prisma.checkIn.create({
      data: {
        stepId: Number(stepId),
        memberId: Number(memberId),
        checkedBy,
      },
    });

    res.status(201).json({ message: 'Check-in successful' });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
};

export const scanQRCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stepId } = req.params;
    const { qrData } = req.body as { qrData?: string };
    const checkedBy = req.user?.id ?? null;

    if (!qrData) {
      res.status(400).json({ error: 'Invalid QR code' });
      return;
    }

    let parsedData: { eventId: number; memberId: number };
    try {
      parsedData = JSON.parse(qrData);
    } catch {
      res.status(400).json({ error: 'Invalid QR code' });
      return;
    }

    const step = await prisma.eventStep.findUnique({
      where: { id: Number(stepId) },
      select: { eventId: true },
    });

    if (!step) {
      res.status(404).json({ error: 'Step not found' });
      return;
    }

    if (step.eventId !== parsedData.eventId) {
      res.status(400).json({ error: 'QR code does not match this event' });
      return;
    }

    const existing = await prisma.checkIn.findFirst({
      where: {
        stepId: Number(stepId),
        memberId: Number(parsedData.memberId),
      },
    });

    if (existing) {
      res.status(400).json({ error: 'Already checked in' });
      return;
    }

    await prisma.checkIn.create({
      data: {
        stepId: Number(stepId),
        memberId: Number(parsedData.memberId),
        checkedBy,
      },
    });

    const member = await prisma.eventMember.findUnique({
      where: { id: Number(parsedData.memberId) },
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    res.status(201).json({
      message: 'Check-in successful',
      member: member
        ? {
            first_name: member.user.firstName,
            last_name: member.user.lastName,
          }
        : null,
    });
  } catch (error) {
    console.error('QR scan error:', error);
    res.status(500).json({ error: 'Failed to process QR code' });
  }
};

export const getCheckIns = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stepId } = req.params;

    const checkIns = await prisma.checkIn.findMany({
      where: { stepId: Number(stepId) },
      orderBy: { checkedInAt: 'desc' },
      include: {
        member: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    type CheckInWithMember = (typeof checkIns)[number];

    res.json(
      checkIns.map((checkIn: CheckInWithMember) => ({
        id: checkIn.id,
        memberId: checkIn.memberId,
        firstName: checkIn.member.user.firstName,
        lastName: checkIn.member.user.lastName,
        role: checkIn.member.role,
        checkedInAt: checkIn.checkedInAt,
      })),
    );
  } catch (error) {
    console.error('Get check-ins error:', error);
    res.status(500).json({ error: 'Failed to get check-ins' });
  }
};

export const getCheckInStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stepId } = req.params;

    const step = await prisma.eventStep.findUnique({
      where: { id: Number(stepId) },
      select: { eventId: true },
    });

    if (!step) {
      res.status(404).json({ error: 'Step not found' });
      return;
    }

    const members = await prisma.eventMember.findMany({
      where: { eventId: step.eventId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    const checkIns = await prisma.checkIn.findMany({
      where: { stepId: Number(stepId) },
      select: { memberId: true },
    });

    const checkedInIds = new Set(checkIns.map((checkIn) => checkIn.memberId));

    type MemberWithUser = (typeof members)[number];
    const status = members.map((member: MemberWithUser) => ({
      memberId: member.id,
      userId: member.user.id,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      role: member.role,
      checkedIn: checkedInIds.has(member.id),
    }));

    res.json({
      total: status.length,
      checkedIn: checkedInIds.size,
      pending: status.length - checkedInIds.size,
      members: status,
    });
  } catch (error) {
    console.error('Get check-in status error:', error);
    res.status(500).json({ error: 'Failed to get check-in status' });
  }
};
