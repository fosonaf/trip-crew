import { Server, Socket } from 'socket.io';
import pool from '../config/database';
import { verifyToken } from '../config/jwt';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
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

        const result = await pool.query(
          'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
          [decoded.userId]
        );

        if (result.rows.length === 0) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        socket.user = result.rows[0];
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

        const result = await pool.query(
          'SELECT id FROM event_members WHERE event_id = $1 AND user_id = $2',
          [eventId, socket.user.id]
        );

        if (result.rows.length === 0) {
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

        const result = await pool.query(
          `INSERT INTO messages (event_id, user_id, content)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [eventId, socket.user.id, content]
        );

        const message = result.rows[0];

        io.to(`event_${eventId}`).emit('new_message', {
          id: message.id,
          content: message.content,
          createdAt: message.created_at,
          user: {
            id: socket.user.id,
            firstName: socket.user.first_name,
            lastName: socket.user.last_name,
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
          firstName: socket.user.first_name,
          lastName: socket.user.last_name,
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