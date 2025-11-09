import express from 'express';
import { 
  createEvent, 
  getEvents, 
  getEventById, 
  updateEvent, 
  deleteEvent 
} from '../controllers/eventController';
import { authenticate, isEventOrganizer } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticate, createEvent);
router.get('/', authenticate, getEvents);
router.get('/:eventId', authenticate, getEventById);
router.put('/:eventId', authenticate, isEventOrganizer, updateEvent);
router.delete('/:eventId', authenticate, isEventOrganizer, deleteEvent);

export default router;