import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  submission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission' },
  reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  form_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Form' },
  level_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Level' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'revision_requested'], default: 'pending' },
  comments: String,
  score: Number,
  grade: String,
}, { timestamps: true });

export const Review = mongoose.model('Review', reviewSchema);
