import cron from 'node-cron';
import { Server } from 'socket.io';
import prisma from '../config/prisma';

const getAlertThreshold = (minutes: number | null | undefined, reference: Date): Date | null => {
  if (minutes === null || minutes === undefined || minutes <= 0) {
    return null;
  }
  return new Date(reference.getTime() + minutes * 60 * 1000);
};

export const startNotificationScheduler = (io: Server): void => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      
      const steps = await prisma.eventStep.findMany({
        where: {
          scheduledTime: { gt: now },
        },
        include: {
          event: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      for (const step of steps) {
        const threshold = getAlertThreshold(step.alertBeforeMinutes, now);
        if (!threshold) {
          continue;
        }

        if (step.scheduledTime > threshold) {
          continue;
        }

        const members = await prisma.eventMember.findMany({
          where: { eventId: step.eventId },
          select: { userId: true },
        });

        for (const member of members) {
          const existingNotification = await prisma.notification.findFirst({
            where: {
              userId: member.userId,
              stepId: step.id,
            },
            select: { id: true },
          });

          if (existingNotification) {
            continue;
          }

          await prisma.notification.create({
            data: {
              userId: member.userId,
              eventId: step.eventId,
              stepId: step.id,
              title: `Upcoming: ${step.name}`,
              message: `${step.name} for ${step.event.name} is scheduled at ${step.scheduledTime.toISOString()}. Location: ${step.location ?? 'TBD'}`,
            },
          });

            if (io) {
            io.to(`user_${member.userId}`).emit('notification', {
                title: `Upcoming: ${step.name}`,
                message: `${step.name} is coming up soon!`,
              eventId: step.eventId,
                stepId: step.id,
              });
          }
        }
      }
    } catch (error) {
      console.error('Notification scheduler error:', error);
    }
  });

  console.log('Notification scheduler started');
};
