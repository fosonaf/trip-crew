import express from 'express';
import { getMessages, createMessage } from '../controllers/messageController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/:eventId/messages', authenticate, getMessages);
router.post('/:eventId/messages', authenticate, createMessage);

export default router;