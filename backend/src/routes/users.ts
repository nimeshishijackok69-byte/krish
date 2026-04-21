import express, { Response } from 'express';
import { User } from '../models/User.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/users - list users with optional role filter
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.query;
    const query: any = {};
    if (role) query.role = role;
    const users = await User.find(query).select('-passwordHash').sort({ createdAt: -1 });
    const mapped = users.map(u => ({
      id: u._id,
      email: u.email,
      role: u.role,
      name: u.profile?.fullName,
      phone: u.profile?.phone,
      school_name: u.profile?.schoolName,
      school_code: u.profile?.schoolCode,
      district: u.profile?.district,
      status: u.isActive ? 'active' : 'inactive',
      created_at: u.createdAt,
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/users - create user or bulk import
router.post('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { action, users: userList, ...userData } = req.body;

    if (action === 'bulk-import' && Array.isArray(userList)) {
      const results = [];
      for (const u of userList) {
        const created = await User.create({
          email: u.email,
          passwordHash: u.password_hash || u.password || 'default123',
          role: u.role || 'teacher',
          profile: {
            fullName: u.name || u.full_name || u.email,
            phone: u.phone,
            schoolName: u.school_name,
            schoolCode: u.school_code,
            district: u.district,
          },
          createdBy: req.user._id,
        });
        results.push({ id: created._id, email: created.email });
      }
      return res.status(201).json({ success: true, count: results.length, users: results });
    }

    const user = await User.create({
      email: userData.email,
      passwordHash: userData.password_hash || userData.password || 'default123',
      role: userData.role || 'teacher',
      profile: {
        fullName: userData.name || userData.full_name || userData.email,
        phone: userData.phone,
        schoolName: userData.school_name,
        schoolCode: userData.school_code,
        district: userData.district,
      },
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, id: user._id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/users - update user
router.put('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'User ID required' });

    const updateData: any = {};
    if (updates.email) updateData.email = updates.email;
    if (updates.role) updateData.role = updates.role;
    if (updates.password_hash) updateData.passwordHash = updates.password_hash;
    if (updates.status) updateData.isActive = updates.status === 'active';
    updateData.profile = {};
    if (updates.name) updateData['profile.fullName'] = updates.name;
    if (updates.phone) updateData['profile.phone'] = updates.phone;
    if (updates.school_name) updateData['profile.schoolName'] = updates.school_name;
    if (updates.school_code) updateData['profile.schoolCode'] = updates.school_code;
    if (updates.district) updateData['profile.district'] = updates.district;
    delete updateData.profile; // use dot notation updates

    const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/users
router.delete('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'User ID required' });
    await User.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
