import mongoose from 'mongoose';

const formVersionSchema = new mongoose.Schema({
  formId: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true, index: true },
  version: { type: Number, required: true },
  title: String,
  changeNotes: String,
  snapshot: mongoose.Schema.Types.Mixed,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

formVersionSchema.index({ formId: 1, version: 1 }, { unique: true });

export const FormVersion = mongoose.model('FormVersion', formVersionSchema);
