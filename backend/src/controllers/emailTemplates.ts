import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { EmailTemplate } from '../models/EmailTemplate.js';

const BUILT_IN_TEMPLATES = [
  {
    name: 'Invite Template',
    type: 'invite',
    subject: 'Invitation: {{form_title}}',
    body: 'Hello {{teacher_name}},\n\nYou have been invited to complete {{form_title}}.\nUse this link: {{form_link}}\nSchool code: {{school_code}}\nDeadline: {{deadline}}'
  },
  {
    name: 'OTP Template',
    type: 'otp',
    subject: 'Your OTP for {{form_title}}',
    body: 'Hello {{user_name}},\n\nYour OTP is {{otp}}.\nIt is valid for a limited time.'
  },
  {
    name: 'Confirmation Template',
    type: 'confirmation',
    subject: 'Submission received for {{form_title}}',
    body: 'Hello {{teacher_name}},\n\nYour submission for {{form_title}} was received on {{submitted_at}}.'
  },
  {
    name: 'Reminder Template',
    type: 'reminder',
    subject: 'Reminder: {{form_title}} is due soon',
    body: 'Hello {{teacher_name}},\n\nThis is a reminder to complete {{form_title}} before {{deadline}}.\nUse this link: {{form_link}}'
  }
];

const normalizeTemplate = (template: any) => ({
  id: template._id,
  name: template.name,
  type: template.type,
  subject: template.subject,
  body: template.body,
  created_at: template.createdAt,
  updated_at: template.updatedAt
});

const ensureBuiltIns = async () => {
  const count = await EmailTemplate.countDocuments();
  if (count === 0) {
    await EmailTemplate.insertMany(BUILT_IN_TEMPLATES);
  }
};

export const getEmailTemplates = async (_req: AuthRequest, res: Response) => {
  try {
    await ensureBuiltIns();
    const templates = await EmailTemplate.find().sort({ createdAt: 1 });
    res.status(200).json(templates.map(normalizeTemplate));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createEmailTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const template = await EmailTemplate.create({
      name: req.body.name,
      type: req.body.type || 'custom',
      subject: req.body.subject || '',
      body: req.body.body || ''
    });
    res.status(201).json(normalizeTemplate(template));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateEmailTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const template = await EmailTemplate.findByIdAndUpdate(
      req.body.id,
      {
        name: req.body.name,
        type: req.body.type,
        subject: req.body.subject,
        body: req.body.body
      },
      { new: true }
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.status(200).json(normalizeTemplate(template));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteEmailTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const template = await EmailTemplate.findByIdAndDelete(req.body.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
