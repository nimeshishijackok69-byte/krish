import mongoose from 'mongoose';

const reminderScheduleSchema = new mongoose.Schema({
  form_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Form' },
  template_id: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' },
  schedule_type: { type: String, enum: ['once', 'recurring'], default: 'once' },
  cron_expression: String,
  next_run_at: Date,
  last_run_at: Date,
  is_active: { type: Boolean, default: true },
  target_role: String,
  subject: String,
  body: String,
}, { timestamps: true });

export const ReminderSchedule = mongoose.model('ReminderSchedule', reminderScheduleSchema);
