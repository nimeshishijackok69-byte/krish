import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  message: String,
  type: { type: String, default: 'info' },
  is_read: { type: Boolean, default: false },
  link: String,
}, { timestamps: true });

export const Notification = mongoose.model('Notification', notificationSchema);
