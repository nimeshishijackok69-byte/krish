import { Response } from 'express';
import { Form } from '../models/Form.js';
import { FormVersion } from '../models/FormVersion.js';
import { AuthRequest } from '../middleware/auth.js';

export const getFormVersions = async (req: AuthRequest, res: Response) => {
  try {
    const formId = typeof req.query.form_id === 'string' ? req.query.form_id : undefined;
    if (!formId) {
      return res.status(400).json({ error: 'form_id is required' });
    }

    let versions = await FormVersion.find({ formId })
      .sort({ version: -1, createdAt: -1 })
      .lean();

    if (versions.length === 0) {
      const form = await Form.findById(formId).lean();
      if (form) {
        const backfilled = await FormVersion.create({
          formId,
          version: 1,
          title: form.title,
          changeNotes: 'Initial creation',
          snapshot: form
        });
        versions = [backfilled.toObject()];
      }
    }

    res.status(200).json(versions.map((version: any) => ({
      id: version._id,
      form_id: version.formId,
      version: version.version,
      title: version.title,
      change_notes: version.changeNotes || '',
      created_at: version.createdAt
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
