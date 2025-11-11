import { Request, Response } from 'express';
import prisma from '../config/prisma';

const parseDateTime = (value: string): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
};

export const createStep = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { name, description, location, scheduledTime } = req.body;

    const event = await prisma.event.findUnique({
      where: { id: Number(eventId) },
      select: { id: true, startDate: true, endDate: true },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const scheduledDate = parseDateTime(scheduledTime);

    if (!scheduledDate) {
      res.status(400).json({ error: 'Invalid step scheduled time' });
      return;
    }

    const eventStart = event.startDate;
    const eventEnd = event.endDate;

    if (
      (eventStart && scheduledDate < eventStart) ||
      (eventEnd && scheduledDate > eventEnd)
    ) {
      res.status(400).json({ error: 'Step must be scheduled within the event timeframe' });
      return;
    }

    const step = await prisma.eventStep.create({
      data: {
        eventId: Number(eventId),
        name,
        description: description ?? null,
        location: location ?? null,
        scheduledTime: scheduledDate,
        alertBeforeMinutes: 30,
      },
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        scheduledTime: true,
      },
    });

    res.status(201).json({
      id: step.id,
      name: step.name,
      description: step.description,
      location: step.location,
      scheduledTime: step.scheduledTime,
    });
  } catch (error) {
    console.error('Create step error:', error);
    res.status(500).json({ error: 'Failed to create step' });
  }
};

export const getSteps = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;

    const steps = await prisma.eventStep.findMany({
      where: { eventId: Number(eventId) },
      orderBy: { scheduledTime: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        scheduledTime: true,
      },
    });

    type StepData = (typeof steps)[number];

    res.json(
      steps.map((step: StepData) => ({
        id: step.id,
        name: step.name,
        description: step.description,
        location: step.location,
        scheduledTime: step.scheduledTime,
      })),
    );
  } catch (error) {
    console.error('Get steps error:', error);
    res.status(500).json({ error: 'Failed to get steps' });
  }
};

export const updateStep = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, stepId } = req.params;
    const { name, description, location, scheduledTime } = req.body;

    const event = await prisma.event.findUnique({
      where: { id: Number(eventId) },
      select: { id: true, startDate: true, endDate: true },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const scheduledDate = parseDateTime(scheduledTime);

    if (!scheduledDate) {
      res.status(400).json({ error: 'Invalid step scheduled time' });
      return;
    }

    const eventStart = event.startDate;
    const eventEnd = event.endDate;

    if (
      (eventStart && scheduledDate < eventStart) ||
      (eventEnd && scheduledDate > eventEnd)
    ) {
      res.status(400).json({ error: 'Step must be scheduled within the event timeframe' });
      return;
    }

    const result = await prisma.eventStep.updateMany({
      where: { id: Number(stepId), eventId: Number(eventId) },
      data: {
        name,
        description: description ?? null,
        location: location ?? null,
        scheduledTime: scheduledDate,
        alertBeforeMinutes: 30,
      },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Step not found' });
      return;
    }

    res.json({ message: 'Step updated successfully' });
  } catch (error) {
    console.error('Update step error:', error);
    res.status(500).json({ error: 'Failed to update step' });
  }
};

export const deleteStep = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, stepId } = req.params;

    await prisma.eventStep.deleteMany({
      where: { id: Number(stepId), eventId: Number(eventId) },
    });

    res.json({ message: 'Step deleted successfully' });
  } catch (error) {
    console.error('Delete step error:', error);
    res.status(500).json({ error: 'Failed to delete step' });
  }
};
