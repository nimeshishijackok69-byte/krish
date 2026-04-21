import express, { Response } from 'express';
import { Nomination } from '../models/Nomination.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/nominations
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { functionary_id, form_id } = req.query;
    const query: any = {};
    if (functionary_id) query.functionary_id = functionary_id;
    if (form_id) query.form_id = form_id;
    const nominations = await Nomination.find(query).sort({ createdAt: -1 });
    const mapped = nominations.map(n => ({
      id: n._id,
      form_id: n.form_id,
      functionary_id: n.functionary_id,
      teacher_email: n.teacher_email,
      teacher_name: n.teacher_name,
      status: n.status,
      reminder_count: n.reminder_count,
      last_reminder_at: n.last_reminder_at,
      submission_id: n.submission_id,
      created_at: n.createdAt,
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/nominations
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { action, nominations: nomList, ...data } = req.body;

    if (action === 'bulk-nominate' && Array.isArray(nomList)) {
      const results = [];
      for (const n of nomList) {
        const created = await Nomination.create({
          form_id: n.form_id,
          functionary_id: n.functionary_id || req.user._id,
          teacher_email: n.teacher_email,
          teacher_name: n.teacher_name,
        });
        results.push({ id: created._id });
      }
      return res.status(201).json({ success: true, count: results.length });
    }

    const nomination = await Nomination.create({
      ...data,
      functionary_id: data.functionary_id || req.user._id,
    });
    res.status(201).json({ id: nomination._id, ...nomination.toObject() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/nominations
router.put('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'Nomination ID required' });
    const nomination = await Nomination.findByIdAndUpdate(id, updates, { new: true });
    if (!nomination) return res.status(404).json({ error: 'Nomination not found' });
    res.json({ success: true, id: nomination._id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
