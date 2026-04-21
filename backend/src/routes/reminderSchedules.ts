import express, { Response } from 'express';
import { ReminderSchedule } from '../models/ReminderSchedule.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/reminder-schedules
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { form_id } = req.query;
    const query: any = {};
    if (form_id) query.form_id = form_id;
    const schedules = await ReminderSchedule.find(query).sort({ createdAt: -1 });
    const mapped = schedules.map(s => ({
      id: s._id,
      form_id: s.form_id,
      template_id: s.template_id,
      schedule_type: s.schedule_type,
      cron_expression: s.cron_expression,
      next_run_at: s.next_run_at,
      last_run_at: s.last_run_at,
      is_active: s.is_active,
      target_role: s.target_role,
      subject: s.subject,
      body: s.body,
      created_at: s.createdAt,
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/reminder-schedules
router.post('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const schedule = await ReminderSchedule.create(req.body);
    res.status(201).json({ id: schedule._id, ...schedule.toObject() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/reminder-schedules
router.put('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'Schedule ID required' });
    const schedule = await ReminderSchedule.findByIdAndUpdate(id, updates, { new: true });
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ success: true, id: schedule._id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/reminder-schedules
router.delete('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Schedule ID required' });
    await ReminderSchedule.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
