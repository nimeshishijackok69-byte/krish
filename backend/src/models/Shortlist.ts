import mongoose from 'mongoose';

const shortlistSchema = new mongoose.Schema({
  submission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission' },
  form_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Form' },
  level_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Level' },
  shortlisted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, default: 'shortlisted' },
  notes: String,
}, { timestamps: true });

export const Shortlist = mongoose.model('Shortlist', shortlistSchema);
