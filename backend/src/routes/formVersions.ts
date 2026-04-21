import express, { Response } from 'express';
import { FormVersion } from '../models/FormVersion.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/form-versions
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { form_id } = req.query;
    const query: any = {};
    if (form_id) query.form_id = form_id;
    const versions = await FormVersion.find(query).sort({ version: -1 });
    const mapped = versions.map(v => ({
      id: v._id,
      form_id: v.form_id,
      version: v.version,
      form_schema: v.form_schema,
      change_notes: v.change_notes,
      updated_by: v.updated_by,
      created_at: v.createdAt,
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
