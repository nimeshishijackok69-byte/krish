import { Request, Response } from 'express';
import { Nomination } from '../models/Nomination.js';
import { User } from '../models/User.js';
import { Form } from '../models/Form.js';
import { AuthRequest } from '../middleware/auth.js';

const ensureTeacherUser = async (teacherData: any) => {
  const email = teacherData.teacher_email?.toLowerCase().trim();
  if (!email) return;

  const existingUser = await User.findOne({ email });
  if (!existingUser) {
    await User.create({
      email,
      role: 'teacher',
      profile: {
        fullName: teacherData.teacher_name || 'Teacher',
        phone: teacherData.teacher_phone || '',
        schoolCode: teacherData.school_code || ''
      }
    });
  }
};

export const getNominations = async (req: AuthRequest, res: Response) => {
  try {
    const { functionary_id, form_id } = req.query;
    const query: any = {};
    if (functionary_id) query.functionary_id = functionary_id;
    if (form_id) query.form_id = form_id;
    
    // Admins can see all, functionaries see theirs
    if (req.user.role === 'functionary') {
      query.functionary_id = req.user._id;
    }

    const nominations = await Nomination.find(query).sort({ createdAt: -1 });
    const mapped = nominations.map(n => ({ ...n.toObject(), id: n._id }));
    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

const resolveNominationLimit = (settings: any) => {
  if (!settings) return 5;
  const parsedSettings = typeof settings === 'string' ? JSON.parse(settings) : settings;
  return parsedSettings?.nomination_limit || parsedSettings?.max_nominations || 5;
};

const enforceNominationLimit = async (formId: string, functionaryId: string) => {
  const form = await Form.findById(formId).lean();
  if (!form) {
    throw Object.assign(new Error('Form not found'), { status: 404 });
  }

  const limit = resolveNominationLimit(form.settings);
  const currentCount = await Nomination.countDocuments({ form_id: formId, functionary_id: functionaryId });
  if (currentCount >= limit) {
    throw Object.assign(new Error(`Nomination limit reached (${limit}/${limit})`), { status: 409 });
  }
};

export const createNomination = async (req: AuthRequest, res: Response) => {
  try {
    const { action, nominations } = req.body;

    if (action === 'bulk-nominate' && Array.isArray(nominations)) {
      const normalized = [];
      for (const nomination of nominations) {
        const formId = nomination.form_id || req.body.form_id;
        await enforceNominationLimit(String(formId), String(req.user._id));
        normalized.push({
          ...nomination,
          form_id: formId,
          functionary_id: req.user._id,
          school_code: nomination.school_code || req.user.profile?.schoolCode || '',
          status: nomination.status || 'invited',
          invited_at: nomination.status === 'pending' ? nomination.invited_at : (nomination.invited_at || new Date())
        });
      }

      const created = [];
      for (const nomination of normalized) {
        created.push(await Nomination.create(nomination));
      }
      // Create user accounts for each nominated teacher
      for (const nom of normalized) {
        await ensureTeacherUser(nom);
      }
      return res.status(201).json({ success: true, count: created.length });
    }

    await enforceNominationLimit(String(req.body.form_id), String(req.user._id));

    const status = req.body.status || 'invited';

    const nomination = await Nomination.create({
      ...req.body,
      functionary_id: req.user._id, // Ensure functionary_id is set to the current user
      school_code: req.body.school_code || req.user.profile?.schoolCode || '',
      status,
      invited_at: status === 'invited' ? (req.body.invited_at || new Date()) : req.body.invited_at
    });

    // Create user account for the nominated teacher
    await ensureTeacherUser(req.body);

    res.status(201).json({ success: true, data: { ...nomination.toObject(), id: nomination._id } });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const updateNomination = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id || req.body.id;
    if (!id) return res.status(400).json({ error: 'Nomination ID required' });
    
    const updates = { ...req.body };
    delete updates.id;
    
    const nomination = await Nomination.findByIdAndUpdate(id, updates, { new: true });
    if (!nomination) return res.status(404).json({ error: 'Nomination not found' });
    res.status(200).json({ success: true, data: { ...nomination.toObject(), id: nomination._id } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteNomination = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Nomination ID required' });
    const nomination = await Nomination.findByIdAndDelete(id);
    if (!nomination) return res.status(404).json({ error: 'Nomination not found' });
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
