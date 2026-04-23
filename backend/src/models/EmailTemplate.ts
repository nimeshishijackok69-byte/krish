import mongoose from 'mongoose';

const emailTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, default: 'custom' },
  subject: { type: String, default: '' },
  body: { type: String, default: '' }
}, { timestamps: true });

export const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);
