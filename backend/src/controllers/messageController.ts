import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);

    const messages = await prisma.message.findMany({
      where: { eventId: Number(eventId) },
      orderBy: { createdAt: 'desc' },
      skip: Number.isNaN(offset) ? 0 : offset,
      take: Number.isNaN(limit) ? 50 : limit,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    type MessageWithUser = (typeof messages)[number];

    res.json(
      messages
        .reverse()
        .map((message: MessageWithUser) => ({
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          user: {
            id: message.user.id,
            firstName: message.user.firstName,
            lastName: message.user.lastName,
          },
        })),
    );
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

export const createMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { content } = req.body as { content?: string };
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    const message = await prisma.message.create({
      data: {
        eventId: Number(eventId),
        userId,
        content: content.trim(),
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        userId: true,
      },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
};
