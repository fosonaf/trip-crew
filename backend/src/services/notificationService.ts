import cron from 'node-cron';
import { Server } from 'socket.io';
import pool from '../config/database';

export const startNotificationScheduler = (io: Server): void => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      
      const result = await pool.query(
        `SELECT es.*, e.name as event_name
         FROM event_steps es
         JOIN events e ON es.event_id = e.id
         WHERE es.scheduled_time > $1
         AND es.scheduled_time <= $1 + (es.alert_before_minutes || ' minutes')::interval`,
        [now]
      );

      for (const step of result.rows) {
        const membersResult = await pool.query(
          'SELECT user_id FROM event_members WHERE event_id = $1',
          [step.event_id]
        );

        for (const member of membersResult.rows) {
          const existingNotif = await pool.query(
            'SELECT id FROM notifications WHERE user_id = $1 AND step_id = $2',
            [member.user_id, step.id]
          );

          if (existingNotif.rows.length === 0) {
            await pool.query(
              `INSERT INTO notifications (user_id, event_id, step_id, title, message)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                member.user_id,
                step.event_id,
                step.id,
                `Upcoming: ${step.name}`,
                `${step.name} for ${step.event_name} is scheduled at ${step.scheduled_time}. Location: ${step.location || 'TBD'}`,
              ]
            );

            if (io) {
              io.to(`user_${member.user_id}`).emit('notification', {
                title: `Upcoming: ${step.name}`,
                message: `${step.name} is coming up soon!`,
                eventId: step.event_id,
                stepId: step.id,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Notification scheduler error:', error);
    }
  });

  console.log('Notification scheduler started');
};