import express, { Response } from 'express';
import { Level } from '../models/Level.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/review-levels
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { form_id } = req.query;
    const query: any = {};
    if (form_id) query.formId = form_id;
    const levels = await Level.find(query).populate('assignedReviewers', 'email profile.fullName').sort({ levelNumber: 1 });
    const mapped = levels.map(l => ({
      id: l._id,
      form_id: l.formId,
      level_number: l.levelNumber,
      name: l.name,
      assigned_reviewers: l.assignedReviewers,
      submissions: l.submissions,
      blind_review: l.blindReview,
      scoring_type: l.scoringType,
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/review-levels
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { form_id, level_number, name, reviewer_ids, blind_review, scoring_type, submission_ids } = req.body;
    
    // Check if level already exists for this form
    const existing = await Level.findOne({ formId: form_id, levelNumber: level_number || 1 });
    if (existing) {
      // Update existing level
      if (reviewer_ids) existing.assignedReviewers = reviewer_ids;
      if (submission_ids) existing.submissions = submission_ids;
      if (name) existing.name = name;
      if (blind_review !== undefined) existing.blindReview = blind_review;
      if (scoring_type) existing.scoringType = scoring_type;
      await existing.save();
      return res.json({ id: existing._id, ...existing.toObject() });
    }
    
    const level = await Level.create({
      formId: form_id,
      levelNumber: level_number || 1,
      name: name || `Level ${level_number || 1}`,
      assignedReviewers: reviewer_ids || [],
      submissions: submission_ids || [],
      blindReview: blind_review || false,
      scoringType: scoring_type || 'form',
    });
    res.status(201).json({ id: level._id, ...level.toObject() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
