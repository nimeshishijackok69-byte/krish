import { Response } from 'express';
import { User } from '../models/User.js';
import { Form } from '../models/Form.js';
import { Submission } from '../models/Submission.js';
import { Nomination } from '../models/Nomination.js';
import { Review } from '../models/Review.js';
import { AuthRequest } from '../middleware/auth.js';

const rangeLabel = (score: number) => {
  if (score < 20) return '0-19';
  if (score < 40) return '20-39';
  if (score < 60) return '40-59';
  if (score < 80) return '60-79';
  return '80-100';
};

const countSubmissionsByStatus = (submissions: any[]) => ({
  submitted: submissions.filter((submission) => submission.status === 'submitted').length,
  under_review: submissions.filter((submission) => submission.status === 'under_review').length,
  approved: submissions.filter((submission) => submission.status === 'approved').length,
  rejected: submissions.filter((submission) => submission.status === 'rejected').length,
  pending: submissions.filter((submission) => submission.status === 'pending').length
});

export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user.role;
    const { form_id } = req.query;
    const formFilter = typeof form_id === 'string' ? { formId: form_id } : {};

    const [activeForms, draftForms, expiredForms, allForms] = await Promise.all([
      Form.countDocuments({ status: 'active' }),
      Form.countDocuments({ status: 'draft' }),
      Form.countDocuments({ status: 'expired' }),
      Form.find().sort({ createdAt: -1 })
    ]);

    if (role === 'admin') {
      const [totalUsers, submissions, nominations, reviews, usersByRole] = await Promise.all([
        User.countDocuments(),
        Submission.find(formFilter).sort({ createdAt: 1 }),
        Nomination.find(),
        Review.find(),
        Promise.all([
          User.countDocuments({ role: 'admin' }),
          User.countDocuments({ role: 'reviewer' }),
          User.countDocuments({ role: 'functionary' }),
          User.countDocuments({ role: 'teacher' })
        ]).then(([admin, reviewer, functionary, teacher]) => ({ admin, reviewer, functionary, teacher }))
      ]);

      const totalSubmissions = submissions.length;
      const submissionsByStatus = countSubmissionsByStatus(submissions);
      const pendingReviews = reviews.filter((review) => review.status === 'pending').length;
      const completedReviews = reviews.filter((review) => review.status !== 'pending').length;
      const scoredSubmissions = submissions.filter((submission) => typeof submission.score?.percentage === 'number');
      const avgScore = scoredSubmissions.length > 0
        ? Math.round(scoredSubmissions.reduce((sum, submission) => sum + submission.score.percentage, 0) / scoredSubmissions.length)
        : 0;
      const submissionTimeline = submissions.reduce((acc: Record<string, number>, submission: any) => {
        const key = new Date(submission.createdAt).toISOString().slice(0, 10);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const scoreDistribution = scoredSubmissions.reduce((acc: Record<string, number>, submission: any) => {
        const label = rangeLabel(submission.score.percentage);
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, { '0-19': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0 });
      const nominationsByStatus = nominations.reduce((acc: Record<string, number>, nomination: any) => {
        acc[nomination.status] = (acc[nomination.status] || 0) + 1;
        return acc;
      }, { invited: 0, in_progress: 0, completed: 0, pending: 0 });
      const schoolCodes = Array.from(new Set([
        ...nominations.map((nomination: any) => nomination.school_code).filter(Boolean),
        ...allForms
          .filter((form: any) => form.formType === 'nomination')
          .map((form: any) => form.settings?.school_code)
          .filter(Boolean)
      ])).sort();
      const completionRate = totalSubmissions > 0
        ? Math.round(((submissionsByStatus.submitted + submissionsByStatus.approved + submissionsByStatus.rejected + submissionsByStatus.under_review) / totalSubmissions) * 100)
        : 0;

      return res.status(200).json({
        totalUsers,
        activeForms,
        draftForms,
        expiredForms,
        totalSubmissions,
        submissionsByStatus,
        usersByRole,
        forms: allForms.map((form: any) => ({
          id: form._id,
          title: form.title,
          status: form.status,
          form_type: form.formType
        })),
        submissionTimeline,
        completionRate,
        avgScore,
        scoreDistribution,
        nominationsByStatus,
        schoolCodes,
        pendingReviews,
        completedReviews,
        totalNominations: nominations.length
      });
    }

    if (role === 'reviewer') {
      const reviews = await Review.find({ reviewer_id: req.user._id });
      const completedReviewsList = reviews.filter((review) => review.status !== 'pending');
      const reviewedScores = completedReviewsList.filter((review) => typeof review.overall_score === 'number');
      const uniqueSubmissionIds = new Set(reviews.map((review) => review.submission_id.toString()));

      return res.status(200).json({
        activeForms,
        totalSubmissions: uniqueSubmissionIds.size,
        pendingReviews: reviews.filter((review) => review.status === 'pending').length,
        completedReviews: completedReviewsList.length,
        avgScore: reviewedScores.length > 0
          ? Math.round(reviewedScores.reduce((sum, review) => sum + (review.overall_score || 0), 0) / reviewedScores.length)
          : 0
      });
    }

    if (role === 'teacher') {
      const submissions = await Submission.find({ ...formFilter, userId: req.user._id }).sort({ createdAt: 1 });
      const submissionsByStatus = countSubmissionsByStatus(submissions);

      return res.status(200).json({
        activeForms,
        totalSubmissions: submissions.length,
        submissionsByStatus
      });
    }

    if (role === 'functionary') {
      const nominations = await Nomination.find({ functionary_id: req.user._id });
      const nominationsByStatus = nominations.reduce((acc: Record<string, number>, nomination: any) => {
        acc[nomination.status] = (acc[nomination.status] || 0) + 1;
        return acc;
      }, { invited: 0, in_progress: 0, completed: 0, pending: 0 });
      const completionRate = nominations.length > 0
        ? Math.round(((nominationsByStatus.completed || 0) / nominations.length) * 100)
        : 0;

      return res.status(200).json({
        activeForms,
        totalNominations: nominations.length,
        nominationsByStatus,
        completionRate
      });
    }

    res.status(200).json({});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
