import express, { Response } from 'express';
import { Shortlist } from '../models/Shortlist.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/shortlist
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { form_id, submission_id } = req.query;
    const query: any = {};
    if (form_id) query.form_id = form_id;
    if (submission_id) query.submission_id = submission_id;
    const items = await Shortlist.find(query).sort({ createdAt: -1 });
    const mapped = items.map(s => ({
      id: s._id,
      submission_id: s.submission_id,
      form_id: s.form_id,
      level_id: s.level_id,
      shortlisted_by: s.shortlisted_by,
      status: s.status,
      notes: s.notes,
      created_at: s.createdAt,
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/shortlist
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const entry = await Shortlist.create({
      ...req.body,
      shortlisted_by: req.body.shortlisted_by || req.user._id,
    });
    res.status(201).json({ id: entry._id, ...entry.toObject() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
