import express from 'express';
import {
  getEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate
} from '../controllers/emailTemplates.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/', getEmailTemplates);
router.post('/', createEmailTemplate);
router.put('/', updateEmailTemplate);
router.delete('/', deleteEmailTemplate);

export default router;
