import express, { Response } from 'express';
import { ReviewScore } from '../models/ReviewScore.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// POST /api/v1/review-scores
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const score = await ReviewScore.create({
      ...req.body,
      reviewer_id: req.body.reviewer_id || req.user._id,
    });
    res.status(201).json({ id: score._id, ...score.toObject() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/review-scores
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { submission_id, form_id } = req.query;
    const query: any = {};
    if (submission_id) query.submission_id = submission_id;
    if (form_id) query.form_id = form_id;
    const scores = await ReviewScore.find(query);
    res.json(scores.map(s => ({ id: s._id, ...s.toObject() })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
