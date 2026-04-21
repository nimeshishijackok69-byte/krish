import mongoose from 'mongoose';

const formVersionSchema = new mongoose.Schema({
  form_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Form' },
  version: { type: Number, default: 1 },
  form_schema: mongoose.Schema.Types.Mixed,
  change_notes: String,
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const FormVersion = mongoose.model('FormVersion', formVersionSchema);
