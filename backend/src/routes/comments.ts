import express, { Response } from 'express';
import { Comment } from '../models/Comment.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/comments
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { submission_id } = req.query;
    const query: any = {};
    if (submission_id) query.submission_id = submission_id;
    const comments = await Comment.find(query).sort({ createdAt: 1 });
    const mapped = comments.map(c => ({
      id: c._id,
      submission_id: c.submission_id,
      user_id: c.user_id,
      user_name: c.user_name,
      user_role: c.user_role,
      content: c.content,
      created_at: c.createdAt,
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/comments
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const comment = await Comment.create(req.body);
    res.status(201).json({ id: comment._id, ...comment.toObject() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
