import express from 'express';
import { 
  createStep, 
  getSteps, 
  updateStep, 
  deleteStep 
} from '../controllers/stepController';
import { authenticate, isEventOrganizer } from '../middleware/auth';

const router = express.Router();

router.post('/:eventId/steps', authenticate, isEventOrganizer, createStep);
router.get('/:eventId/steps', authenticate, getSteps);
router.put('/:eventId/steps/:stepId', authenticate, isEventOrganizer, updateStep);
router.delete('/:eventId/steps/:stepId', authenticate, isEventOrganizer, deleteStep);

export default router;