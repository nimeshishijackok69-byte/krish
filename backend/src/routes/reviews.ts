import express, { Response } from 'express';
import { Review } from '../models/Review.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/reviews
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { reviewer_id, form_id, submission_id } = req.query;
    const query: any = {};
    if (reviewer_id) query.reviewer_id = reviewer_id;
    if (form_id) query.form_id = form_id;
    if (submission_id) query.submission_id = submission_id;
    const reviews = await Review.find(query).sort({ createdAt: -1 });
    const mapped = reviews.map(r => ({
      id: r._id,
      submission_id: r.submission_id,
      reviewer_id: r.reviewer_id,
      form_id: r.form_id,
      level_id: r.level_id,
      status: r.status,
      comments: r.comments,
      score: r.score,
      grade: r.grade,
      created_at: r.createdAt,
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/reviews
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const review = await Review.create(req.body);
    res.status(201).json({ id: review._id, ...review.toObject() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/reviews
router.put('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'Review ID required' });
    const review = await Review.findByIdAndUpdate(id, updates, { new: true });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json({ success: true, ...review.toObject(), id: review._id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
