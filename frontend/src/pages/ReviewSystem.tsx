import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import {
  BarChart3,
  CheckCircle,
  ChevronRight,
  Clock,
  Eye,
  Layers,
  Save,
  Users,
  XCircle,
  Zap
} from 'lucide-react';

const responsesToMap = (responses: any) => {
  if (!responses) return {} as Record<string, any>;
  if (Array.isArray(responses)) {
    return responses.reduce((acc: Record<string, any>, response: any) => {
      if (response?.fieldId) acc[response.fieldId] = response.value;
      return acc;
    }, {});
  }
  if (typeof responses === 'string') {
    try {
      return responsesToMap(JSON.parse(responses));
    } catch {
      return {};
    }
  }
  return responses;
};

const normalizeFormFields = (form: any) => {
  const sections = form?.form_schema?.sections || form?.schema?.sections || [];
  return sections.flatMap((section: any) => section.fields || []);
};

export default function ReviewSystem({ user }: { user: User }) {
  const navigate = useNavigate();
  const [forms, setForms] = useState<any[]>([]);
  const [reviewers, setReviewers] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [shortlistData, setShortlistData] = useState<any>(null);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingFormData, setLoadingFormData] = useState(false);

  const [showCreateLevel, setShowCreateLevel] = useState(false);
  const [showShortlist, setShowShortlist] = useState(false);
  const [levelForm, setLevelForm] = useState({
    form_id: '',
    name: '',
    level_number: 1,
    scoring_type: 'form_level',
    grade_scale: 'A,B,C,D',
    blind_review: false,
    reviewer_ids: [] as string[]
  });
  const [shortlistFilter, setShortlistFilter] = useState({
    filter_type: 'all',
    filter_value: '0',
    source_level_id: '',
    field_id: '',
    field_value: ''
  });
  const [shortlistResult, setShortlistResult] = useState<any>(null);

  const [reviewTab, setReviewTab] = useState<'pending' | 'completed'>('pending');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [overallScore, setOverallScore] = useState(0);
  const [grade, setGrade] = useState('');
  const [recommendation, setRecommendation] = useState('');

  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadBaseData = async () => {
    try {
      setLoading(true);
      const requests = [
        api.get('/forms'),
        api.get('/review-levels'),
        user.role === 'admin' ? api.get('/reviews') : api.get(`/reviews?reviewer_id=${user.id}`)
      ];

      if (user.role === 'admin') {
        requests.push(api.get('/users?role=reviewer'));
      }

      const [formsData, levelsData, reviewsData, reviewersData] = await Promise.all(requests);
      setForms(Array.isArray(formsData) ? formsData.filter((form: any) => ['active', 'expired'].includes(form.status)) : []);
      setLevels(Array.isArray(levelsData) ? levelsData : []);
      setReviews(Array.isArray(reviewsData) ? reviewsData : []);
      setReviewers(Array.isArray(reviewersData) ? reviewersData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBaseData();
  }, [user.id, user.role]);

  const loadFormData = async (formId: string) => {
    setSelectedFormId(formId);
    setShortlistResult(null);
    if (!formId) {
      setShortlistData(null);
      return;
    }

    try {
      setLoadingFormData(true);
      const [shortlist, formLevels] = await Promise.all([
        api.get(`/shortlist?form_id=${formId}`),
        api.get(`/review-levels?form_id=${formId}`)
      ]);
      setShortlistData(shortlist);
      setLevels((prev) => {
        const otherLevels = prev.filter((level) => String(level.form_id) !== String(formId));
        return [...otherLevels, ...formLevels];
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFormData(false);
    }
  };

  const openProfile = async (submissionId: string) => {
    try {
      setProfileLoading(true);
      setShowProfile(true);
      const data = await api.get(`/shortlist?submission_id=${submissionId}`);
      setProfileData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setProfileLoading(false);
    }
  };

  const openReview = async (review: any) => {
    try {
      setSelectedReview(review);
      const submissionResponse = await api.get(`/submissions/${review.submission_id}`);
      setSelectedSub(submissionResponse.data || submissionResponse);
      setReviewComment(review.comments || '');
      setOverallScore(review.overall_score || 0);
      setGrade(review.grade || '');
      setRecommendation(review.recommendation || '');
      setShowReviewModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const createLevel = async () => {
    if (!levelForm.form_id || !levelForm.name.trim()) return;

    await api.post('/review-levels', {
      form_id: levelForm.form_id,
      level_number: levelForm.level_number,
      name: levelForm.name.trim(),
      scoring_type: levelForm.scoring_type,
      grade_scale: levelForm.grade_scale.split(',').map((value) => value.trim()).filter(Boolean),
      blind_review: levelForm.blind_review,
      reviewer_ids: levelForm.reviewer_ids
    });

    setShowCreateLevel(false);
    await loadBaseData();
    if (selectedFormId && selectedFormId === levelForm.form_id) {
      await loadFormData(selectedFormId);
    }
  };

  const createShortlist = async () => {
    if (!selectedFormId || levelForm.reviewer_ids.length === 0) return;

    let levelId = levels.find((level) => String(level.form_id) === String(selectedFormId) && level.level_number === levelForm.level_number)?.id;
    if (!levelId) {
      const createdLevel = await api.post('/review-levels', {
        form_id: selectedFormId,
        level_number: levelForm.level_number,
        name: levelForm.name || `Level ${levelForm.level_number}`,
        scoring_type: levelForm.scoring_type,
        grade_scale: levelForm.grade_scale.split(',').map((value) => value.trim()).filter(Boolean),
        blind_review: levelForm.blind_review,
        reviewer_ids: levelForm.reviewer_ids
      });
      levelId = createdLevel.id;
    }

    const result = await api.post('/shortlist', {
      action: 'create-shortlist',
      form_id: selectedFormId,
      level_id: levelId,
      filter_type: shortlistFilter.filter_type,
      filter_value: shortlistFilter.filter_value,
      source_level_id: shortlistFilter.source_level_id || undefined,
      field_id: shortlistFilter.field_id || undefined,
      field_value: shortlistFilter.field_value || undefined,
      reviewer_ids: levelForm.reviewer_ids
    });

    setShortlistResult(result);
    await loadBaseData();
    await loadFormData(selectedFormId);
  };

  const saveDraft = async () => {
    if (!selectedReview) return;

    await api.post('/review-scores', {
      review_id: selectedReview.id,
      overall_score: overallScore,
      grade,
      comments: reviewComment,
      recommendation,
      is_draft: true
    });

    await loadBaseData();
    alert('Draft saved!');
  };

  const submitReview = async (status: 'approved' | 'rejected') => {
    if (!selectedReview) return;

    await api.post('/review-scores', {
      review_id: selectedReview.id,
      overall_score: overallScore,
      grade,
      comments: reviewComment,
      recommendation: recommendation || (status === 'approved' ? 'approve' : 'reject'),
      status,
      is_draft: false
    });

    setShowReviewModal(false);
    setSelectedReview(null);
    setSelectedSub(null);
    await loadBaseData();
    if (selectedFormId) {
      await loadFormData(selectedFormId);
    }
  };

  const selectedForm = forms.find((form) => String(form.id) === String(selectedFormId));
  const selectedFormFields = normalizeFormFields(selectedForm);
  const filteredLevels = useMemo(
    () => selectedFormId ? levels.filter((level) => String(level.form_id) === String(selectedFormId)) : levels,
    [levels, selectedFormId]
  );
  const filteredReviews = useMemo(
    () => selectedFormId ? reviews.filter((review) => String(review.form_id) === String(selectedFormId)) : reviews,
    [reviews, selectedFormId]
  );

  const adminStats = {
    pending: filteredReviews.filter((review) => review.status === 'pending').length,
    approved: filteredReviews.filter((review) => review.status === 'approved').length,
    rejected: filteredReviews.filter((review) => review.status === 'rejected').length
  };

  const reviewerPending = reviews.filter((review) => review.status === 'pending');
  const reviewerCompleted = reviews.filter((review) => review.status !== 'pending');
  const displayedReviews = reviewTab === 'pending' ? reviewerPending : reviewerCompleted;
  const selectedResponses = responsesToMap(selectedSub?.responses);

  const adminColumns = [
    { key: 'user_name', label: 'Name', sortable: true, render: (value: string, row: any) => (
      <div>
        <p className="text-sm font-medium">{value || 'Anonymous'}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400">{row.user_email}</p>
      </div>
    ) },
    { key: 'score', label: 'Form Score', sortable: true, render: (value: any) => value != null ? <span className="font-bold text-primary">{value}%</span> : <span className="text-slate-400">-</span> },
    { key: 'highest_level', label: 'Reached', sortable: true, render: (value: number) => value > 0 ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">L{value}</span> : <span className="text-slate-400">-</span> },
    { key: 'status', label: 'Status', render: (value: string) => <StatusBadge status={value} /> }
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (user.role === 'admin') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold font-heading">Review System</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Configure review levels, assign reviewers, and monitor decisions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setLevelForm((prev) => ({
                  ...prev,
                  form_id: selectedFormId || prev.form_id,
                  level_number: filteredLevels.length + 1,
                  name: filteredLevels.length > 0 ? `Level ${filteredLevels.length + 1}` : ''
                }));
                setShowCreateLevel(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-white dark:hover:bg-slate-800"
            >
              <Layers size={15} /> Create Level
            </button>
            <button
              onClick={() => {
                setLevelForm((prev) => ({
                  ...prev,
                  form_id: selectedFormId,
                  level_number: filteredLevels.length + 1,
                  name: `Level ${filteredLevels.length + 1}`
                }));
                setShortlistFilter((prev) => ({
                  ...prev,
                  source_level_id: filteredLevels[filteredLevels.length - 1]?.id || ''
                }));
                setShowShortlist(true);
              }}
              disabled={!selectedFormId}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap size={15} /> Create Shortlist
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Form</label>
          <select
            value={selectedFormId}
            onChange={(e) => loadFormData(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none focus:border-primary"
          >
            <option value="">All review levels</option>
            {forms.map((form) => (
              <option key={form.id} value={form.id}>{form.title} ({form.form_type})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Pending', value: adminStats.pending, icon: Clock, tone: 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800' },
            { label: 'Approved', value: adminStats.approved, icon: CheckCircle, tone: 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800' },
            { label: 'Rejected', value: adminStats.rejected, icon: XCircle, tone: 'text-red-600 bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800' }
          ].map((card) => (
            <div key={card.label} className={`rounded-2xl border p-4 ${card.tone}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide">{card.label}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                </div>
                <card.icon size={22} />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-bold font-heading flex items-center gap-2 mb-4"><Layers size={15} className="text-primary" /> Review Levels</h3>
          {filteredLevels.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No review levels configured yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredLevels.map((level) => (
                <div key={level.id} className="p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-primary uppercase">Level {level.level_number}</p>
                      <p className="text-sm font-bold mt-1">{level.name}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{level.scoring_type?.replace('_', ' ')}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">{level.blind_review ? 'Blind review' : 'Open review'} · {level.reviewer_ids?.length || 0} reviewer(s)</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedFormId && (
          <DataTable
            title={`Submissions (${shortlistData?.submissions?.length || 0})`}
            subtitle="Open a submission profile to review level-wise scores and responses."
            columns={adminColumns}
            data={shortlistData?.submissions || []}
            loading={loadingFormData}
            searchPlaceholder="Search by name or email"
            onRowClick={(row: any) => openProfile(row.id)}
            actions={(row: any) => (
              <button onClick={(event) => { event.stopPropagation(); openProfile(row.id); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="View profile">
                <Eye size={14} />
              </button>
            )}
          />
        )}

        <Modal open={showCreateLevel} onClose={() => setShowCreateLevel(false)} title="Create Review Level" size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Form</label>
                <select value={levelForm.form_id} onChange={(e) => setLevelForm((prev) => ({ ...prev, form_id: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                  <option value="">Select Form</option>
                  {forms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Level Number</label>
                <input type="number" value={levelForm.level_number} onChange={(e) => setLevelForm((prev) => ({ ...prev, level_number: parseInt(e.target.value) || 1 }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Name</label>
                <input value={levelForm.name} onChange={(e) => setLevelForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none" placeholder="Level 1 - Primary Review" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Scoring Type</label>
                <select value={levelForm.scoring_type} onChange={(e) => setLevelForm((prev) => ({ ...prev, scoring_type: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                  <option value="form_level">Form Level</option>
                  <option value="question_level">Question Level</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Grade Scale</label>
                <input value={levelForm.grade_scale} onChange={(e) => setLevelForm((prev) => ({ ...prev, grade_scale: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none" placeholder="A,B,C,D" />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <input type="checkbox" checked={levelForm.blind_review} onChange={(e) => setLevelForm((prev) => ({ ...prev, blind_review: e.target.checked }))} className="accent-primary rounded" />
                  Blind review
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Reviewers</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {reviewers.map((reviewer) => {
                  const checked = levelForm.reviewer_ids.includes(String(reviewer.id));
                  return (
                    <label key={reviewer.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${checked ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setLevelForm((prev) => ({
                          ...prev,
                          reviewer_ids: e.target.checked
                            ? [...prev.reviewer_ids, String(reviewer.id)]
                            : prev.reviewer_ids.filter((id) => id !== String(reviewer.id))
                        }))}
                        className="accent-primary"
                      />
                      <div>
                        <p className="text-sm font-semibold">{reviewer.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{reviewer.email}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreateLevel(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold">Cancel</button>
              <button onClick={createLevel} className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover">Create Level</button>
            </div>
          </div>
        </Modal>

        <Modal open={showShortlist} onClose={() => setShowShortlist(false)} title={`Create Shortlist${selectedForm ? ` for ${selectedForm.title}` : ''}`} size="xl">
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Filter Type</label>
                <select value={shortlistFilter.filter_type} onChange={(e) => setShortlistFilter((prev) => ({ ...prev, filter_type: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                  <option value="all">All Submissions</option>
                  <option value="form_score_gte">Form Score ≥</option>
                  <option value="review_avg_gte">Previous Level Avg ≥</option>
                  <option value="field_value">Field Equals</option>
                </select>
              </div>
              {(shortlistFilter.filter_type === 'form_score_gte' || shortlistFilter.filter_type === 'review_avg_gte') && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Minimum Score</label>
                  <input value={shortlistFilter.filter_value} onChange={(e) => setShortlistFilter((prev) => ({ ...prev, filter_value: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none" />
                </div>
              )}
              {shortlistFilter.filter_type === 'review_avg_gte' && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Source Level</label>
                  <select value={shortlistFilter.source_level_id} onChange={(e) => setShortlistFilter((prev) => ({ ...prev, source_level_id: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                    <option value="">Select level</option>
                    {filteredLevels.map((level) => <option key={level.id} value={level.id}>L{level.level_number}: {level.name}</option>)}
                  </select>
                </div>
              )}
              {shortlistFilter.filter_type === 'field_value' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Field</label>
                    <select value={shortlistFilter.field_id} onChange={(e) => setShortlistFilter((prev) => ({ ...prev, field_id: e.target.value, field_value: '' }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                      <option value="">Select field</option>
                      {selectedFormFields.map((field: any) => <option key={field.id} value={field.id}>{field.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Value</label>
                    {selectedFormFields.find((field: any) => field.id === shortlistFilter.field_id)?.options ? (
                      <select value={shortlistFilter.field_value} onChange={(e) => setShortlistFilter((prev) => ({ ...prev, field_value: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                        <option value="">Select value</option>
                        {selectedFormFields.find((field: any) => field.id === shortlistFilter.field_id)?.options?.map((option: string) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : (
                      <input value={shortlistFilter.field_value} onChange={(e) => setShortlistFilter((prev) => ({ ...prev, field_value: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none" />
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Level Name</label>
                <input value={levelForm.name} onChange={(e) => setLevelForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Level Number</label>
                <input type="number" value={levelForm.level_number} onChange={(e) => setLevelForm((prev) => ({ ...prev, level_number: parseInt(e.target.value) || 1 }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Assign Reviewers</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {reviewers.map((reviewer) => {
                  const checked = levelForm.reviewer_ids.includes(String(reviewer.id));
                  return (
                    <label key={reviewer.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${checked ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setLevelForm((prev) => ({
                          ...prev,
                          reviewer_ids: e.target.checked
                            ? [...prev.reviewer_ids, String(reviewer.id)]
                            : prev.reviewer_ids.filter((id) => id !== String(reviewer.id))
                        }))}
                        className="accent-primary"
                      />
                      <div>
                        <p className="text-sm font-semibold">{reviewer.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{reviewer.email}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {shortlistResult && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Shortlist created</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{shortlistResult.shortlisted} submissions shortlisted and {shortlistResult.reviews_created} review tasks created.</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowShortlist(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold">Close</button>
              <button onClick={createShortlist} className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover">Create Shortlist</button>
            </div>
          </div>
        </Modal>

        <Modal open={showProfile} onClose={() => { setShowProfile(false); setProfileData(null); }} title="Submission Profile" size="2xl">
          {profileLoading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : profileData ? (
            <div className="space-y-5">
              <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-4">
                <h3 className="font-bold">{profileData.submission.userName || profileData.submission.user_name || 'Anonymous'}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{profileData.submission.userEmail || profileData.submission.user_email} · {profileData.submission.form_title}</p>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={profileData.submission.status} />
                  {profileData.submission.score != null && <span className="text-xs font-semibold text-primary">Score: {profileData.submission.score}%</span>}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold font-heading flex items-center gap-2 mb-3"><BarChart3 size={15} className="text-primary" /> Level-wise Scores</h3>
                <div className="space-y-3">
                  {profileData.levels.map((level: any) => (
                    <div key={level.level_id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold">L{level.level_number}: {level.level_name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{level.scoring_type?.replace('_', ' ')} · {level.blind_review ? 'Blind' : 'Open'} review</p>
                        </div>
                        {level.average_score != null && <span className="text-xl font-bold text-primary">{level.average_score}</span>}
                      </div>
                      <div className="space-y-2 mt-3">
                        {level.scores.length === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400">Not reviewed yet.</p> : level.scores.map((score: any, index: number) => (
                          <div key={index} className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">{score.overall_score}</span>
                              {score.grade && <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">{score.grade}</span>}
                              {score.recommendation && <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">{score.recommendation.replace('_', ' ')}</span>}
                            </div>
                            {score.comments && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{score.comments}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold font-heading mb-3">Form Responses</h3>
                <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-4 space-y-2">
                  {Object.entries(responsesToMap(profileData.submission.responses)).map(([key, value]) => (
                    <div key={key} className="flex flex-col sm:flex-row gap-1 py-1.5 border-b border-slate-200 dark:border-slate-700/30 last:border-0">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-[150px]">{key}:</span>
                      <span className="text-sm">{Array.isArray(value) ? value.join(', ') : String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => navigate(`/forms/view?submission=${profileData.submission.id}`)} className="w-full py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center gap-2">
                <Eye size={14} /> View Full Form Response
              </button>
            </div>
          ) : null}
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold font-heading">My Reviews</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Open assigned submissions, save drafts, and finalize decisions.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-amber-100 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-amber-700 dark:text-amber-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide">Pending Reviews</p>
              <p className="text-2xl font-bold mt-1">{reviewerPending.length}</p>
            </div>
            <Clock size={22} />
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 text-emerald-700 dark:text-emerald-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide">Completed</p>
              <p className="text-2xl font-bold mt-1">{reviewerCompleted.length}</p>
            </div>
            <CheckCircle size={22} />
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 rounded-xl p-1 w-fit">
        {(['pending', 'completed'] as const).map((tab) => (
          <button key={tab} onClick={() => setReviewTab(tab)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize ${reviewTab === tab ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
            {tab} ({tab === 'pending' ? reviewerPending.length : reviewerCompleted.length})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {displayedReviews.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">No {reviewTab} reviews.</div>
        ) : displayedReviews.map((review) => (
          <div key={review.id} onClick={() => review.status === 'pending' ? openReview(review) : openProfile(review.submission_id)} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">{review.form_title ? review.form_title[0] : '#'}</div>
            <div className="flex-1">
              <p className="text-sm font-bold">{review.form_title || `Submission ${review.submission_id}`}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Level {review.level} · {review.reviewer_name}</p>
            </div>
            <StatusBadge status={review.status} />
            <ChevronRight size={16} className="text-slate-500 dark:text-slate-400" />
          </div>
        ))}
      </div>

      <Modal open={showReviewModal} onClose={() => setShowReviewModal(false)} title={`Review Submission #${selectedReview?.submission_id || ''}`} size="xl">
        {selectedReview && (
          <div className="space-y-5">
            {selectedSub && (
              <div>
                <h4 className="text-sm font-bold mb-2">Submission Responses</h4>
                <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-4 space-y-2 max-h-60 overflow-y-auto">
                  {Object.entries(selectedResponses).map(([key, value]) => (
                    <div key={key} className="flex flex-col sm:flex-row gap-1 py-1 border-b border-slate-200 dark:border-slate-700/30 last:border-0">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-[140px]">{key}:</span>
                      <span className="text-sm">{Array.isArray(value) ? value.join(', ') : String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Overall Score (0-100)</label>
                <input type="number" min={0} max={100} value={overallScore} onChange={(e) => setOverallScore(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Grade</label>
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                  <option value="">Select Grade</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Recommendation</label>
                <select value={recommendation} onChange={(e) => setRecommendation(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                  <option value="">Select</option>
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                  <option value="next_level">Promote to Next Level</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Review Comments</label>
              <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none h-24 resize-none" />
            </div>

            <div className="flex gap-3">
              <button onClick={saveDraft} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-white dark:hover:bg-slate-800 flex items-center gap-2 min-h-[44px]">
                <Save size={14} /> Save Draft
              </button>
              <button onClick={() => submitReview('approved')} className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold text-sm hover:bg-emerald-600 flex items-center justify-center gap-2 min-h-[44px]">
                <CheckCircle size={16} /> Approve
              </button>
              <button onClick={() => submitReview('rejected')} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 flex items-center justify-center gap-2 min-h-[44px]">
                <XCircle size={16} /> Reject
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={showProfile} onClose={() => { setShowProfile(false); setProfileData(null); }} title="Submission Profile" size="2xl">
        {profileLoading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : profileData ? (
          <div className="space-y-5">
            <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-4">
              <h3 className="font-bold">{profileData.submission.userName || profileData.submission.user_name || 'Anonymous'}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{profileData.submission.userEmail || profileData.submission.user_email} · {profileData.submission.form_title}</p>
            </div>
            {profileData.levels.map((level: any) => (
              <div key={level.level_id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold">L{level.level_number}: {level.level_name}</span>
                  {level.average_score != null && <span className="text-xl font-bold text-primary">{level.average_score}</span>}
                </div>
                <div className="space-y-2 mt-3">
                  {level.scores.length === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400">Not reviewed yet.</p> : level.scores.map((score: any, index: number) => (
                    <div key={index} className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{score.overall_score}</span>
                        {score.grade && <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">{score.grade}</span>}
                      </div>
                      {score.comments && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{score.comments}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
