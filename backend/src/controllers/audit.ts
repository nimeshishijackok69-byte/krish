import { Response } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { AuthRequest } from '../middleware/auth.js';

const normalizeLog = (log: any) => ({
  id: log._id,
  user_id: log.userId,
  action: log.action,
  details: {
    ...(log.details || {}),
    ...(log.metadata || {})
  },
  metadata: log.metadata || {},
  created_at: log.createdAt
});

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const action = req.query.action as string | undefined;
    const query: any = {};
    if (action) {
      query.action = action === 'login' ? { $regex: /^login/ } : action;
    }

    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(limit);
    res.status(200).json(logs.map(normalizeLog));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createAuditLog = async (req: AuthRequest, res: Response) => {
  try {
    const { action, details } = req.body;
    const parsedDetails = typeof details === 'string' ? JSON.parse(details) : details;
    const log = await AuditLog.create({
      userId: req.user?._id || req.body.user_id,
      action,
      details: parsedDetails,
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });
    res.status(201).json(normalizeLog(log));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
