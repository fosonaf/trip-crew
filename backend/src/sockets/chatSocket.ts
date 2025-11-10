import { Server, Socket } from 'socket.io';
import prisma from '../config/prisma';
import { verifyToken } from '../config/jwt';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: number;
    email: string | null;
    firstName: string;
    lastName: string;
  };
  currentEventId?: number;
}

export const setupChatSocket = (io: Server): void => {
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log('User connected:', socket.id);

    socket.on('authenticate', async (token: string) => {
      try {
        const decoded = verifyToken(token);
        if (!decoded) {
          socket.emit('error', { message: 'Invalid token' });
          return;
        }

        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        });

        if (!user) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        socket.user = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        };

        socket.emit('authenticated', { user: socket.user });
      } catch (error) {
        console.error('Socket auth error:', error);
        socket.emit('error', { message: 'Authentication failed' });
      }
    });

    socket.on('join_event', async (eventId: number) => {
      try {
        if (!socket.user) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const membership = await prisma.eventMember.findFirst({
          where: {
            eventId,
            userId: socket.user.id,
            status: 'active',
          },
          select: { id: true },
        });

        if (!membership) {
          socket.emit('error', { message: 'Not a member of this event' });
          return;
        }

        socket.join(`event_${eventId}`);
        socket.currentEventId = eventId;
        socket.emit('joined_event', { eventId });
        console.log(`User ${socket.user.id} joined event ${eventId}`);
      } catch (error) {
        console.error('Join event error:', error);
        socket.emit('error', { message: 'Failed to join event' });
      }
    });

    socket.on('leave_event', (eventId: number) => {
      socket.leave(`event_${eventId}`);
      socket.currentEventId = undefined;
      socket.emit('left_event', { eventId });
    });

    socket.on('send_message', async (data: { eventId: number; content: string }) => {
      try {
        if (!socket.user) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { eventId, content } = data;

        const message = await prisma.message.create({
          data: {
            eventId,
            userId: socket.user.id,
            content,
          },
          select: {
            id: true,
            content: true,
            createdAt: true,
          },
        });

        io.to(`event_${eventId}`).emit('new_message', {
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          user: {
            id: socket.user.id,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
          },
        });
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing', (eventId: number) => {
      if (socket.user) {
        socket.to(`event_${eventId}`).emit('user_typing', {
          userId: socket.user.id,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName,
        });
      }
    });

    socket.on('stop_typing', (eventId: number) => {
      if (socket.user) {
        socket.to(`event_${eventId}`).emit('user_stop_typing', {
          userId: socket.user.id,
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};
