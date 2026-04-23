import express from 'express';
import { getFormVersions } from '../controllers/formVersions.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, authorize('admin'), getFormVersions);

export default router;
