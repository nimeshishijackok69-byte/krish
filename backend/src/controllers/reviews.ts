import { Response } from 'express';
import { Submission } from '../models/Submission.js';
import { Level } from '../models/Level.js';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { AuthRequest } from '../middleware/auth.js';

const normalizeLevel = (level: any) => ({
  ...level.toObject(),
  id: level._id,
  form_id: level.formId,
  level_number: level.levelNumber,
  blind_review: level.blindReview,
  scoring_type: level.scoringType === 'question' ? 'question_level' : 'form_level',
  reviewer_ids: (level.assignedReviewers || []).map((reviewerId: any) => reviewerId?.toString?.() || reviewerId),
  grade_scale: level.gradeScale || []
});

const normalizeReview = (review: any, reviewerMap: Map<string, any>, submissionMap: Map<string, any>) => {
  const reviewer = reviewerMap.get(review.reviewer_id?.toString());
  const submission = submissionMap.get(review.submission_id?.toString());

  return {
    ...review.toObject(),
    id: review._id,
    submission_id: review.submission_id,
    reviewer_id: review.reviewer_id,
    reviewer_name: reviewer?.profile?.fullName || reviewer?.email || 'Reviewer',
    form_id: submission?.formId || null,
    form_title: submission?.formTitle || ''
  };
};

const buildReviewerMaps = async (reviews: any[]) => {
  const reviewerIds = Array.from(new Set(reviews.map((review) => review.reviewer_id?.toString()).filter(Boolean)));
  const submissionIds = Array.from(new Set(reviews.map((review) => review.submission_id?.toString()).filter(Boolean)));

  const [reviewers, submissions] = await Promise.all([
    reviewerIds.length > 0 ? User.find({ _id: { $in: reviewerIds } }) : [],
    submissionIds.length > 0 ? Submission.find({ _id: { $in: submissionIds } }) : []
  ]);

  return {
    reviewerMap: new Map<string, any>(reviewers.map((reviewer: any) => [reviewer._id.toString(), reviewer] as [string, any])),
    submissionMap: new Map<string, any>(submissions.map((submission: any) => [submission._id.toString(), submission] as [string, any]))
  };
};

export const getLevels = async (req: AuthRequest, res: Response) => {
  try {
    const form_id = typeof req.query.form_id === 'string' ? req.query.form_id : undefined;
    const query: any = {};
    if (form_id) query.formId = form_id;

    const levels = await Level.find(query).sort({ levelNumber: 1 });
    res.status(200).json(levels.map(normalizeLevel));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createLevel = async (req: AuthRequest, res: Response) => {
  try {
    const { form_id, level_number, name, scoring_type, blind_review, reviewer_ids, grade_scale } = req.body;

    const level = await Level.create({
      formId: form_id,
      levelNumber: level_number,
      name,
      scoringType: scoring_type === 'form_level' ? 'form' : 'question',
      blindReview: blind_review,
      assignedReviewers: reviewer_ids,
      gradeScale: Array.isArray(grade_scale) ? grade_scale : []
    });

    res.status(201).json(normalizeLevel(level));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getShortlistData = async (req: AuthRequest, res: Response) => {
  try {
    const form_id = typeof req.query.form_id === 'string' ? req.query.form_id : undefined;
    const submission_id = typeof req.query.submission_id === 'string' ? req.query.submission_id : undefined;

    if (submission_id) {
      const submission = await Submission.findById(submission_id).populate('formId');
      if (!submission) return res.status(404).json({ error: 'Submission not found' });

      const levels = await Level.find({ formId: submission.formId }).sort({ levelNumber: 1 });
      const reviews = await Review.find({ submission_id }).sort({ level: 1 });

      const levelData = levels.map((level) => {
        const levelReviews = reviews.filter((review) => review.level_id.toString() === level._id.toString());
        const scores = levelReviews.map((review) => ({
          overall_score: review.overall_score,
          grade: review.grade,
          comments: review.comments,
          recommendation: review.recommendation,
          created_at: review.createdAt
        }));
        const averageScore = scores.length > 0
          ? scores.reduce((sum, score) => sum + (score.overall_score || 0), 0) / scores.length
          : null;

        return {
          level_id: level._id,
          level_number: level.levelNumber,
          level_name: level.name,
          scoring_type: level.scoringType === 'question' ? 'question_level' : 'form_level',
          blind_review: level.blindReview,
          total_reviewers: levelReviews.length,
          average_score: averageScore != null ? Math.round(averageScore * 10) / 10 : null,
          scores
        };
      });

      return res.status(200).json({
        submission: {
          ...submission.toObject(),
          id: submission._id,
          form_title: (submission.formId as any).title,
          score: submission.score?.percentage
        },
        levels: levelData,
        highest_level: reviews.length > 0 ? Math.max(...reviews.map((review) => review.level)) : 0,
        total_levels: levels.length,
        comments: []
      });
    }

    if (form_id) {
      const submissions = await Submission.find({ formId: form_id, isDraft: false });
      const levels = await Level.find({ formId: form_id }).sort({ levelNumber: 1 });
      const reviews = await Review.find({ submission_id: { $in: submissions.map((submission) => submission._id) } });

      const submissionData = submissions.map((submission) => {
        const submissionReviews = reviews.filter((review) => review.submission_id.toString() === submission._id.toString());
        const levelAverages: Record<string, number[]> = {};

        submissionReviews.forEach((review) => {
          const key = `level_${review.level}`;
          if (!levelAverages[key]) levelAverages[key] = [];
          levelAverages[key].push(review.overall_score || 0);
        });

        const averages = Object.fromEntries(
          Object.entries(levelAverages).map(([key, values]) => [
            key,
            values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0
          ])
        );

        return {
          ...submission.toObject(),
          id: submission._id,
          user_name: submission.userName,
          user_email: submission.userEmail,
          score: submission.score?.percentage,
          highest_level: submissionReviews.length > 0 ? Math.max(...submissionReviews.map((review) => review.level)) : 0,
          level_averages: averages
        };
      });

      return res.status(200).json({
        submissions: submissionData,
        levels: levels.map(normalizeLevel)
      });
    }

    res.status(400).json({ error: 'form_id or submission_id required' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createShortlist = async (req: AuthRequest, res: Response) => {
  try {
    const { action, form_id, level_id, filter_type, filter_value, reviewer_ids, source_level_id, field_id, field_value } = req.body;

    if (action !== 'create-shortlist') return res.status(400).json({ error: 'Invalid action' });

    const level = await Level.findById(level_id);
    if (!level) return res.status(404).json({ error: 'Level not found' });

    const query: any = { formId: form_id, isDraft: false };
    if (filter_type === 'form_score_gte') {
      query['score.percentage'] = { $gte: parseFloat(filter_value) };
    }

    let submissions = await Submission.find(query);

    if (filter_type === 'review_avg_gte' && source_level_id) {
      const sourceLevel = await Level.findById(source_level_id);
      if (!sourceLevel) return res.status(404).json({ error: 'Source level not found' });

      const previousReviews = await Review.find({ level_id: sourceLevel._id });
      const averageMap = new Map<string, { total: number; count: number }>();

      previousReviews.forEach((review) => {
        const key = review.submission_id.toString();
        const current = averageMap.get(key) || { total: 0, count: 0 };
        current.total += review.overall_score || 0;
        current.count += 1;
        averageMap.set(key, current);
      });

      submissions = submissions.filter((submission) => {
        const stats = averageMap.get(submission._id.toString());
        const average = stats && stats.count > 0 ? stats.total / stats.count : 0;
        return average >= parseFloat(filter_value || 0);
      });
    }

    if (filter_type === 'field_value' && field_id) {
      submissions = submissions.filter((submission: any) => {
        const response = (submission.responses || []).find((item: any) => item.fieldId === field_id);
        const actualValue = response?.value;
        if (Array.isArray(actualValue)) {
          return actualValue.map(String).includes(String(field_value));
        }
        return String(actualValue ?? '') === String(field_value ?? '');
      });
    }

    let shortlistedCount = 0;
    let reviewsCreated = 0;

    for (const submission of submissions) {
      const existing = await Review.findOne({ submission_id: submission._id, level_id });
      if (existing) continue;

      shortlistedCount++;

      for (const reviewerId of reviewer_ids) {
        await Review.create({
          submission_id: submission._id,
          reviewer_id: reviewerId,
          level: level.levelNumber,
          level_id: level._id,
          status: 'pending'
        });
        reviewsCreated++;
      }

      await Submission.findByIdAndUpdate(submission._id, { status: 'under_review', currentLevel: level.levelNumber });
    }

    res.status(201).json({
      shortlisted: shortlistedCount,
      reviews_created: reviewsCreated,
      reviewers: reviewer_ids.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getReviews = async (req: AuthRequest, res: Response) => {
  try {
    const reviewer_id = typeof req.query.reviewer_id === 'string' ? req.query.reviewer_id : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const query: any = {};
    if (reviewer_id) query.reviewer_id = reviewer_id;
    if (status) query.status = status;

    if (req.user.role === 'reviewer') {
      query.reviewer_id = req.user._id;
    }

    const reviews = await Review.find(query).sort({ createdAt: -1 });
    const { reviewerMap, submissionMap } = await buildReviewerMaps(reviews);

    res.status(200).json(reviews.map((review) => normalizeReview(review, reviewerMap, submissionMap)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateReview = async (req: AuthRequest, res: Response) => {
  try {
    const { id, status, comments } = req.body;
    const review = await Review.findByIdAndUpdate(id, { status, comments, reviewed_at: new Date() }, { new: true });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.status(200).json(review);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const saveReviewScore = async (req: AuthRequest, res: Response) => {
  try {
    const { review_id, overall_score, grade, comments, recommendation, is_draft, status } = req.body;
    const existingReview = await Review.findById(review_id);
    if (!existingReview) return res.status(404).json({ error: 'Review not found' });

    const finalStatus = is_draft
      ? 'pending'
      : status || (recommendation === 'reject' ? 'rejected' : recommendation === 'approve' ? 'approved' : existingReview.status);

    const review = await Review.findByIdAndUpdate(review_id, {
      overall_score,
      grade,
      comments,
      recommendation,
      is_draft,
      status: finalStatus,
      reviewed_at: is_draft ? null : new Date()
    }, { new: true });

    if (!review) return res.status(404).json({ error: 'Review not found' });

    if (!is_draft && (finalStatus === 'approved' || finalStatus === 'rejected')) {
      await Submission.findByIdAndUpdate(review.submission_id, { status: finalStatus });

      await AuditLog.create({
        userId: req.user?._id,
        action: 'review',
        targetType: 'submission',
        targetId: review.submission_id,
        details: {
          review_id: review._id,
          submission_id: review.submission_id,
          decision: finalStatus,
          score: overall_score,
          grade,
          recommendation
        },
        metadata: {
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }
      });
    }

    res.status(200).json(review);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
