import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Upload, X, Plus, FileText, Save } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { INITIAL_PROFILE } from '../../data/dashboard';
import { targetProfileSchema, type TargetProfileFormValues } from '../../lib/schemas';
import { useToast } from '../../lib/toast';
import { usePageMeta } from '../../lib/seo';

export default function TargetProfilePage() {
  usePageMeta({
    title: 'Target Profile — Crackpilot',
    description: 'Configure your target role, tech stack, resume, and job description for resume-aware live suggestions.',
  });

  const { toast } = useToast();
  const [techStack, setTechStack] = useState<string[]>(INITIAL_PROFILE.techStack);
  const [tagInput, setTagInput] = useState('');
  const [resumeFileName, setResumeFileName] = useState(INITIAL_PROFILE.resumeFileName);
  const [dragActive, setDragActive] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TargetProfileFormValues>({
    resolver: zodResolver(targetProfileSchema),
    defaultValues: {
      targetRole: INITIAL_PROFILE.targetRole,
      experienceLevel: INITIAL_PROFILE.experienceLevel,
      companyType: INITIAL_PROFILE.companyType,
      jobDescription: INITIAL_PROFILE.jobDescription,
    },
  });

  useEffect(() => {
    fetch('/api/profile', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.profile) return;
        const p = data.profile;
        reset({
          targetRole: p.targetRole,
          experienceLevel: p.experienceLevel,
          companyType: p.companyType,
          jobDescription: p.jobDescription,
        });
        if (Array.isArray(p.techStack)) setTechStack(p.techStack);
        if (p.resumeFileName) setResumeFileName(p.resumeFileName);
      })
      .catch(() => {});
  }, [reset]);

  const addTag = () => {
    const cleaned = tagInput.trim();
    if (!cleaned) return;
    if (!techStack.some((t) => t.toLowerCase() === cleaned.toLowerCase())) {
      setTechStack((prev) => [...prev, cleaned]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTechStack((prev) => prev.filter((item) => item !== tag));
  };

  const handleFilePick = (file: File | undefined) => {
    if (!file) return;
    setResumeFileName(file.name);
    toast({ title: 'Resume attached', description: `${file.name} ready for profile sync.`, variant: 'info' });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    handleFilePick(e.dataTransfer.files?.[0]);
  };

  const onSubmit = async (values: TargetProfileFormValues) => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...values, techStack, resumeFileName }),
      });
      if (!res.ok) {
        toast({ title: 'Save failed', description: 'Could not save profile changes.', variant: 'error' });
        return;
      }
      toast({
        title: 'Target profile saved',
        description: 'Live suggestions will now prioritize this role, stack, and resume.',
      });
    } catch {
      toast({ title: 'Network error', description: 'Could not reach server.', variant: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">Target Profile</h1>
        <p className="text-sm text-ink-muted">
          Ground every live answer in your actual resume, stack, and target job description.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <Card padding="lg" className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Target role"
              placeholder="Senior Frontend Engineer"
              error={errors.targetRole?.message}
              {...register('targetRole')}
            />
            <div className="space-y-1.5">
              <label htmlFor="exp-level" className="block text-sm font-medium text-ink">
                Experience level
              </label>
              <select
                id="exp-level"
                className="min-h-[44px] w-full rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5 text-sm text-ink transition-colors hover:border-border-strong focus:border-primary-500 focus:bg-surface focus:outline-none"
                {...register('experienceLevel')}
              >
                <option value="0–2 years (Entry / Fresher)">0–2 years (Entry / Fresher)</option>
                <option value="2–5 years (Mid-level)">2–5 years (Mid-level)</option>
                <option value="5–8 years (Senior)">5–8 years (Senior)</option>
                <option value="8+ years (Staff / Principal)">8+ years (Staff / Principal)</option>
                <option value="Manager / Director">Manager / Director</option>
              </select>
              {errors.experienceLevel && (
                <p role="alert" className="text-xs font-medium text-rose-500">
                  {errors.experienceLevel.message}
                </p>
              )}
            </div>
          </div>

          <Input
            label="Target company type"
            placeholder="Product-led SaaS (Series B–D), Enterprise FinTech, FAANG..."
            error={errors.companyType?.message}
            {...register('companyType')}
          />

          {/* Tech Stack Tag Input */}
          <div className="space-y-2">
            <label htmlFor="stack-input" className="block text-sm font-medium text-ink">
              Core tech stack &amp; skills
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="stack-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Type a skill (e.g., Kubernetes, System Design) and press Enter"
                className="min-h-[44px] flex-1 rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-primary-500 focus:bg-surface focus:outline-none"
              />
              <Button type="button" variant="secondary" onClick={addTag}>
                <Plus className="h-4 w-4" />
                Add tag
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {techStack.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary-500/25 bg-primary-500/10 px-2.5 py-1 font-mono text-xs text-primary-600 dark:text-lavender-200"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeTag(skill)}
                    aria-label={`Remove ${skill}`}
                    className="rounded hover:bg-primary-500/20 p-0.5 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Resume Upload Dropzone */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-ink">Resume (PDF or DOCX)</span>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                dragActive
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-border-strong bg-surface-subtle/60 hover:border-primary-500/50'
              }`}
            >
              <Upload className="mx-auto h-7 w-7 text-primary-500" aria-hidden="true" />
              <p className="mt-2.5 text-sm font-medium text-ink">
                Drag and drop your latest resume here
              </p>
              <p className="mt-1 text-xs text-ink-faint">PDF or DOCX up to 5 MB</p>
              <label className="mt-4 inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-xl border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-ink hover:border-primary-500/50">
                Choose file
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="sr-only"
                  onChange={(e) => handleFilePick(e.target.files?.[0])}
                />
              </label>

              {resumeFileName && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3.5 py-2 text-xs text-ink">
                  <FileText className="h-4 w-4 text-primary-500 shrink-0" />
                  <span className="font-mono truncate max-w-[240px]">{resumeFileName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Job Description */}
          <div className="space-y-1.5">
            <label htmlFor="jd-text" className="block text-sm font-medium text-ink">
              Target job description
            </label>
            <textarea
              id="jd-text"
              rows={5}
              placeholder="Paste the role responsibilities and required qualifications..."
              className="w-full rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-primary-500 focus:bg-surface focus:outline-none"
              {...register('jobDescription')}
            />
            {errors.jobDescription && (
              <p role="alert" className="text-xs font-medium text-rose-500">
                {errors.jobDescription.message}
              </p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={isSubmitting}>
              <Save className="h-4 w-4" />
              Save Target Profile
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
