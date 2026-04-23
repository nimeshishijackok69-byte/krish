import { Response } from 'express';
import { User } from '../models/User.js';
import { Form } from '../models/Form.js';
import { Submission } from '../models/Submission.js';
import { Nomination } from '../models/Nomination.js';
import { AuthRequest } from '../middleware/auth.js';

const rangeLabel = (score: number) => {
  if (score < 20) return '0-19';
  if (score < 40) return '20-39';
  if (score < 60) return '40-59';
  if (score < 80) return '60-79';
  return '80-100';
};

export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const { form_id } = req.query;
    const submissionQuery: any = {};
    if (form_id) submissionQuery.formId = form_id;

    const [totalUsers, activeForms, draftForms, expiredForms, allForms, submissions, nominations] = await Promise.all([
      User.countDocuments(),
      Form.countDocuments({ status: 'active' }),
      Form.countDocuments({ status: 'draft' }),
      Form.countDocuments({ status: 'expired' }),
      Form.find().sort({ createdAt: -1 }),
      Submission.find(submissionQuery).sort({ createdAt: 1 }),
      Nomination.find()
    ]);

    const totalSubmissions = submissions.length;
    const submissionsByStatus = {
      submitted: submissions.filter(sub => sub.status === 'submitted').length,
      under_review: submissions.filter(sub => sub.status === 'under_review').length,
      approved: submissions.filter(sub => sub.status === 'approved').length,
      rejected: submissions.filter(sub => sub.status === 'rejected').length,
      pending: submissions.filter(sub => sub.status === 'pending').length
    };

    const usersByRole = {
      admin: await User.countDocuments({ role: 'admin' }),
      reviewer: await User.countDocuments({ role: 'reviewer' }),
      functionary: await User.countDocuments({ role: 'functionary' }),
      teacher: await User.countDocuments({ role: 'teacher' })
    };

    const submissionTimeline = submissions.reduce((acc: Record<string, number>, submission: any) => {
      const key = new Date(submission.createdAt).toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const scoredSubmissions = submissions.filter(sub => typeof sub.score?.percentage === 'number');
    const avgScore = scoredSubmissions.length > 0
      ? Math.round(scoredSubmissions.reduce((sum, sub) => sum + sub.score.percentage, 0) / scoredSubmissions.length)
      : 0;

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

    const completedStatuses = submissionsByStatus.submitted + submissionsByStatus.approved + submissionsByStatus.rejected + submissionsByStatus.under_review;
    const completionRate = totalSubmissions > 0 ? Math.round((completedStatuses / totalSubmissions) * 100) : 0;

    res.status(200).json({
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
      schoolCodes
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
