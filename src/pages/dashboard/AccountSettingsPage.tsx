import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { INITIAL_PROFILE } from '../../data/dashboard';
import { accountSettingsSchema, type AccountSettingsFormValues } from '../../lib/schemas';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { usePageMeta } from '../../lib/seo';

export default function AccountSettingsPage() {
  usePageMeta({
    title: 'Account Settings — Crackpilot',
    description: 'Update your contact details, theme preference, notification controls, or delete your account.',
  });

  const navigate = useNavigate();
  const { user, refreshSession } = useAuth();
  const { toast } = useToast();

  const [prefs, setPrefs] = useState({
    sessionSummaries: true,
    creditLowAlerts: true,
    productUpdates: false,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountSettingsFormValues>({
    resolver: zodResolver(accountSettingsSchema),
    defaultValues: {
      fullName: user?.name || INITIAL_PROFILE.fullName,
      email: user?.email || INITIAL_PROFILE.email,
      phone: INITIAL_PROFILE.phone,
    },
  });

  useEffect(() => {
    fetch('/api/profile', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.profile) return;
        reset({
          fullName: data.profile.fullName,
          email: data.profile.email,
          phone: data.profile.phone,
        });
      })
      .catch(() => {});
  }, [reset]);

  const onSave = async (values: AccountSettingsFormValues) => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        toast({ title: 'Could not save settings', variant: 'error' });
        return;
      }
      toast({ title: 'Account settings updated' });
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await fetch('/api/account', { method: 'DELETE', credentials: 'include' });
      await refreshSession();
      toast({ title: 'Account deleted', description: 'Your session and workspace data were removed.', variant: 'info' });
      navigate('/', { replace: true });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">Account Settings</h1>
        <p className="text-sm text-ink-muted">
          Manage personal details, appearance, notifications, and workspace privacy.
        </p>
      </div>

      {/* Contact Details */}
      <Card padding="lg">
        <h2 className="text-base font-bold text-ink mb-4">Profile Details</h2>
        <form onSubmit={handleSubmit(onSave)} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full name" error={errors.fullName?.message} {...register('fullName')} />
            <Input label="Phone / WhatsApp" type="tel" error={errors.phone?.message} {...register('phone')} />
          </div>
          <Input label="Email address" type="email" error={errors.email?.message} {...register('email')} />
          <div className="flex justify-end pt-1">
            <Button type="submit" loading={isSubmitting}>
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Appearance & Notifications */}
      <Card padding="lg" className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-5">
          <div>
            <h2 className="text-base font-bold text-ink">Appearance</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Switch between dark navy and lavender-tinted light mode.
            </p>
          </div>
          <ThemeToggle showLabel />
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-bold text-ink">Notification Preferences</h2>
          {[
            {
              key: 'sessionSummaries' as const,
              title: 'Post-session transcripts',
              desc: 'Email a private Q&A recap right after each completed interview.',
            },
            {
              key: 'creditLowAlerts' as const,
              title: 'Low credit reminders',
              desc: 'Notify when remaining interview balance drops below 30 minutes.',
            },
            {
              key: 'productUpdates' as const,
              title: 'Desktop release notes',
              desc: 'Receive updates for Windows, macOS, and Android app versions.',
            },
          ].map((item) => {
            const enabled = prefs[item.key];
            return (
              <label
                key={item.key}
                className="flex items-start justify-between gap-4 rounded-xl border border-border-subtle bg-surface-subtle/60 p-4 cursor-pointer"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => {
                    setPrefs((prev) => ({ ...prev, [item.key]: e.target.checked }));
                    toast({ title: 'Preference saved', variant: 'info' });
                  }}
                  className="mt-1 h-5 w-5 rounded border-border-strong accent-primary-500 cursor-pointer shrink-0"
                />
              </label>
            );
          })}
        </div>
      </Card>

      {/* Danger Zone */}
      <Card padding="lg" className="border-rose-500/35">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-ink">Delete Account</h2>
            <p className="text-xs text-ink-muted max-w-md">
              Permanently remove your profile, custom Knowledge Engine entries, session transcripts, and active device tokens. This cannot be undone.
            </p>
          </div>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>
        </div>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your Crackpilot account?"
        description="All saved Q&A entries, transcripts, and remaining unused minutes will be permanently removed."
        maxWidth="sm"
      >
        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="outline" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleting} onClick={handleDeleteAccount}>
            Confirm Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
