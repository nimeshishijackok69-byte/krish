import { Response } from 'express';
import { User } from '../models/User.js';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth.js';

const extractSchoolCode = (email?: string) => {
  const match = String(email || '').trim().toLowerCase().match(/^head\.([a-z0-9]+)@cbss\.school\.org$/i);
  return match?.[1]?.toUpperCase();
};

const normalizeUser = (user: any) => ({
  id: user._id,
  email: user.email,
  role: user.role,
  name: user.profile?.fullName || user.name || '',
  phone: user.profile?.phone || '',
  school_name: user.profile?.schoolName || '',
  school_code: user.profile?.schoolCode || extractSchoolCode(user.email) || '',
  district: user.profile?.district || '',
  status: user.isActive ? 'active' : 'inactive',
  created_at: user.createdAt,
  updated_at: user.updatedAt,
  assignedLevels: user.assignedLevels || []
});

const buildProfile = (data: any) => ({
  fullName: data.name || data.fullName || data.profile?.fullName || '',
  phone: data.phone || data.profile?.phone || '',
  schoolName: data.school_name || data.schoolName || data.profile?.schoolName || '',
  schoolCode: data.school_code || data.schoolCode || data.profile?.schoolCode || extractSchoolCode(data.email) || '',
  district: data.district || data.profile?.district || ''
});

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.query;
    const query: any = {};
    if (role) query.role = role;

    const users = await User.find(query).sort({ createdAt: -1 });
    res.status(200).json(users.map(normalizeUser));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { action, users } = req.body;

    if (action === 'bulk-import' && Array.isArray(users)) {
      const usersToCreate = await Promise.all(users.map(async (u: any) => {
        const password = u.password_hash || Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        return {
          email: String(u.email || '').trim().toLowerCase(),
          role: u.role || 'teacher',
          passwordHash: await bcrypt.hash(password, salt),
          profile: buildProfile(u),
          isActive: (u.status || 'active') !== 'inactive'
        };
      }));
      const created = await User.insertMany(usersToCreate);
      return res.status(201).json({ success: true, count: created.length, users: created.map(normalizeUser) });
    }

    const email = String(req.body.email || '').trim().toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(req.body.password_hash || 'School@123', salt);

    const user = await User.create({
      email,
      role: req.body.role,
      passwordHash,
      profile: buildProfile({ ...req.body, email }),
      isActive: (req.body.status || 'active') !== 'inactive'
    });

    res.status(201).json(normalizeUser(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id, password_hash, ...updates } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (updates.email) user.email = String(updates.email).trim().toLowerCase();
    if (updates.role) user.role = updates.role;
    user.profile = {
      ...(user.profile || {}),
      ...buildProfile({ ...user.profile, ...updates, email: user.email })
    };
    if (updates.status) user.isActive = updates.status !== 'inactive';

    if (password_hash) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password_hash, salt);
    }

    await user.save();
    res.status(200).json(normalizeUser(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.body;
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
