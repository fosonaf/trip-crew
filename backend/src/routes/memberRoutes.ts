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
  removePendingInvitation,
  leaveEvent,
  requestEventJoin,
  listEventJoinRequests,
  acceptJoinRequest,
  declineJoinRequest,
} from '../controllers/memberController';
import { authenticate, isEventOrganizer } from '../middleware/auth';

const router = express.Router();

router.get('/invitations/pending', authenticate, listPendingInvitations);
router.post('/invitations/:memberId/accept', authenticate, acceptInvitation);
router.post('/invitations/:memberId/decline', authenticate, declineInvitation);
router.post('/:eventId/invitations', authenticate, isEventOrganizer, inviteMember);
router.get('/:eventId/requests', authenticate, isEventOrganizer, listEventJoinRequests);
router.post('/:eventId/requests', authenticate, requestEventJoin);
router.post('/:eventId/requests/:requestId/accept', authenticate, isEventOrganizer, acceptJoinRequest);
router.post('/:eventId/requests/:requestId/decline', authenticate, isEventOrganizer, declineJoinRequest);
router.post('/:eventId/join', authenticate, joinEvent);
router.delete('/:eventId/leave', authenticate, leaveEvent);
router.get('/:eventId/qrcode', authenticate, getMemberQRCode);
router.put('/:eventId/members/:memberId/role', authenticate, isEventOrganizer, updateMemberRole);
router.put('/:eventId/members/:memberId/payment', authenticate, isEventOrganizer, updatePaymentStatus);
router.delete('/:eventId/members/:memberId', authenticate, isEventOrganizer, removeMember);
router.delete('/:eventId/invitations/:memberId', authenticate, isEventOrganizer, removePendingInvitation);

export default router;