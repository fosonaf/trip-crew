import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt';
import prisma from '../config/prisma';

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

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = user;
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

    const event = await prisma.event.findUnique({
      where: { id: Number(eventId) },
      select: { createdBy: true },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    if (event.createdBy === userId) {
      next();
      return;
    }

    const organizerMembership = await prisma.eventMember.findFirst({
      where: {
        eventId: Number(eventId),
        userId,
        role: 'organizer',
        status: 'active',
      },
      select: { id: true },
    });

    if (!organizerMembership) {
      res.status(403).json({ error: 'Access denied. Organizer role required.' });
      return;
    }

    next();
  } catch (error) {
    console.error('Organizer check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};