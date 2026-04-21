import mongoose from 'mongoose';

const reviewScoreSchema = new mongoose.Schema({
  submission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission' },
  reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  form_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Form' },
  level_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Level' },
  scores: mongoose.Schema.Types.Mixed,
  overall_score: Number,
  grade: String,
  comments: String,
}, { timestamps: true });

export const ReviewScore = mongoose.model('ReviewScore', reviewScoreSchema);
