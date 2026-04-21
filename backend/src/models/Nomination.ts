import mongoose from 'mongoose';

const nominationSchema = new mongoose.Schema({
  form_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Form' },
  functionary_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  teacher_email: String,
  teacher_name: String,
  status: { type: String, enum: ['pending', 'submitted', 'expired'], default: 'pending' },
  reminder_count: { type: Number, default: 0 },
  last_reminder_at: Date,
  submission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission' },
}, { timestamps: true });

export const Nomination = mongoose.model('Nomination', nominationSchema);
