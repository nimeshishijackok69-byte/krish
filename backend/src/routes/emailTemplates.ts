import express, { Response } from 'express';
import { EmailTemplate } from '../models/EmailTemplate.js';
import { ReminderSchedule } from '../models/ReminderSchedule.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/email-templates
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const templates = await EmailTemplate.find().sort({ createdAt: -1 });
    const mapped = templates.map(t => ({
      id: t._id,
      name: t.name,
      subject: t.subject,
      body: t.body,
      type: t.type,
      variables: t.variables,
      created_at: t.createdAt,
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/email-templates
router.post('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const template = await EmailTemplate.create(req.body);
    res.status(201).json({ id: template._id, ...template.toObject() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/email-templates
router.put('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'Template ID required' });
    const template = await EmailTemplate.findByIdAndUpdate(id, updates, { new: true });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true, id: template._id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/email-templates
router.delete('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Template ID required' });
    await EmailTemplate.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
