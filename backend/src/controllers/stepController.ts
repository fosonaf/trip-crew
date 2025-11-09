import { Request, Response } from 'express';
import pool from '../config/database';

export const createStep = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { name, description, location, scheduledTime, alertBeforeMinutes } = req.body;

    const result = await pool.query(
      `INSERT INTO event_steps (event_id, name, description, location, scheduled_time, alert_before_minutes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [eventId, name, description, location, scheduledTime, alertBeforeMinutes || 30]
    );

    const step = result.rows[0];

    res.status(201).json({
      id: step.id,
      name: step.name,
      description: step.description,
      location: step.location,
      scheduledTime: step.scheduled_time,
      alertBeforeMinutes: step.alert_before_minutes,
    });
  } catch (error) {
    console.error('Create step error:', error);
    res.status(500).json({ error: 'Failed to create step' });
  }
};

export const getSteps = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;

    const result = await pool.query(
      'SELECT * FROM event_steps WHERE event_id = $1 ORDER BY scheduled_time',
      [eventId]
    );

    const steps = result.rows.map(step => ({
      id: step.id,
      name: step.name,
      description: step.description,
      location: step.location,
      scheduledTime: step.scheduled_time,
      alertBeforeMinutes: step.alert_before_minutes,
    }));

    res.json(steps);
  } catch (error) {
    console.error('Get steps error:', error);
    res.status(500).json({ error: 'Failed to get steps' });
  }
};

export const updateStep = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, stepId } = req.params;
    const { name, description, location, scheduledTime, alertBeforeMinutes } = req.body;

    const result = await pool.query(
      `UPDATE event_steps 
       SET name = $1, description = $2, location = $3, scheduled_time = $4, 
           alert_before_minutes = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND event_id = $7
       RETURNING *`,
      [name, description, location, scheduledTime, alertBeforeMinutes, stepId, eventId]
    );

    if (result.rows.length === 0) {
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
    await pool.query(
      'DELETE FROM event_steps WHERE id = $1 AND event_id = $2',
      [stepId, eventId]
    );
    res.json({ message: 'Step deleted successfully' });
  } catch (error) {
    console.error('Delete step error:', error);
    res.status(500).json({ error: 'Failed to delete step' });
  }
};