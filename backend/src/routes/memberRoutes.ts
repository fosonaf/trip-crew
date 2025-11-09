import express from 'express';
import { 
  joinEvent, 
  updateMemberRole, 
  updatePaymentStatus, 
  removeMember,
  getMemberQRCode
} from '../controllers/memberController';
import { authenticate, isEventOrganizer } from '../middleware/auth';

const router = express.Router();

router.post('/:eventId/join', authenticate, joinEvent);
router.get('/:eventId/qrcode', authenticate, getMemberQRCode);
router.put('/:eventId/members/:memberId/role', authenticate, isEventOrganizer, updateMemberRole);
router.put('/:eventId/members/:memberId/payment', authenticate, isEventOrganizer, updatePaymentStatus);
router.delete('/:eventId/members/:memberId', authenticate, isEventOrganizer, removeMember);

export default router;