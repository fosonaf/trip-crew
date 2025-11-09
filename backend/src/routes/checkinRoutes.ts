import express from 'express';
import { 
  checkIn, 
  scanQRCode, 
  getCheckIns, 
  getCheckInStatus 
} from '../controllers/checkinController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.post('/steps/:stepId/checkin', authenticate, checkIn);
router.post('/steps/:stepId/scan', authenticate, scanQRCode);
router.get('/steps/:stepId/checkins', authenticate, getCheckIns);
router.get('/steps/:stepId/status', authenticate, getCheckInStatus);

export default router;