import express from 'express';
import express from 'express';
import { 
  joinEvent, 
  updateMemberRole, 
  updatePaymentStatus, 
  removeMember,
  getMemberQRCode,
  inviteMember,
  listPendingInvitations,
  acceptInvitation,
  declineInvitation,
} from '../controllers/memberController';
import { authenticate, isEventOrganizer } from '../middleware/auth';

const router = express.Router();

router.get('/invitations/pending', authenticate, listPendingInvitations);
router.post('/invitations/:memberId/accept', authenticate, acceptInvitation);
router.post('/invitations/:memberId/decline', authenticate, declineInvitation);
router.post('/:eventId/invitations', authenticate, isEventOrganizer, inviteMember);
router.post('/:eventId/join', authenticate, joinEvent);
router.get('/:eventId/qrcode', authenticate, getMemberQRCode);
router.put('/:eventId/members/:memberId/role', authenticate, isEventOrganizer, updateMemberRole);
router.put('/:eventId/members/:memberId/payment', authenticate, isEventOrganizer, updatePaymentStatus);
router.delete('/:eventId/members/:memberId', authenticate, isEventOrganizer, removeMember);

export default router;