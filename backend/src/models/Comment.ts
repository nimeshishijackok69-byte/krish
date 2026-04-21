import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  submission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  user_name: String,
  user_role: String,
  content: String,
}, { timestamps: true });

export const Comment = mongoose.model('Comment', commentSchema);
