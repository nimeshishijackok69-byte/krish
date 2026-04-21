import express, { Response } from 'express';
import { Notification } from '../models/Notification.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/notifications
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { user_id } = req.query;
    const query: any = {};
    if (user_id) query.userId = user_id;
    else query.userId = req.user._id;
    const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(50);
    const mapped = notifications.map(n => ({
      id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      is_read: n.is_read,
      link: n.link,
      created_at: n.createdAt,
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/notifications - mark as read
router.put('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id, user_id, is_read } = req.body;
    if (id === 'all') {
      await Notification.updateMany({ userId: user_id || req.user._id }, { is_read: true });
    } else {
      await Notification.findByIdAndUpdate(id, { is_read });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
