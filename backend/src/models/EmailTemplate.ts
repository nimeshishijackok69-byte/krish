import mongoose from 'mongoose';

const emailTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: String,
  body: String,
  type: { type: String, default: 'custom' },
  variables: [String],
}, { timestamps: true });

export const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);
