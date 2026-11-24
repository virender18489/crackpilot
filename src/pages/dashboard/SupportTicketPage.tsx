import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Paperclip, Send, LifeBuoy } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { INITIAL_TICKETS, type SupportTicket } from '../../data/dashboard';
import { supportTicketSchema, type SupportTicketFormValues } from '../../lib/schemas';
import { useToast } from '../../lib/toast';
import { usePageMeta } from '../../lib/seo';

export default function SupportTicketPage() {
  usePageMeta({
    title: 'Support Ticket — Crackpilot',
    description: 'Open a support ticket for audio setup, desktop capture, or billing questions and track past tickets.',
  });

  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>(INITIAL_TICKETS);
  const [attachmentName, setAttachmentName] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupportTicketFormValues>({
    resolver: zodResolver(supportTicketSchema),
    defaultValues: {
      subject: '',
      category: 'Technical Setup',
      description: '',
    },
  });

  useEffect(() => {
    fetch('/api/tickets', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.tickets)) setTickets(data.tickets);
      })
      .catch(() => {});
  }, []);

  const onSubmit = async (values: SupportTicketFormValues) => {
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...values, attachmentName }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
        reset();
        setAttachmentName('');
        toast({
          title: `Ticket ${data.ticket.id} created`,
          description: 'Our support engineers typically respond within 2 hours.',
        });
      }
    } catch {
      toast({ title: 'Could not submit ticket', variant: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">Support Ticket</h1>
        <p className="text-sm text-ink-muted">
          Need help configuring loopback audio, screen capture permissions, or invoices? Open a ticket below.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card padding="lg" className="lg:col-span-7">
          <h2 className="text-base font-bold text-ink mb-4">New Support Request</h2>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <Input
              label="Subject"
              placeholder="e.g., Audio loopback not detecting Bluetooth headset"
              error={errors.subject?.message}
              {...register('subject')}
            />

            <div className="space-y-1.5">
              <label htmlFor="tkt-cat" className="block text-sm font-medium text-ink">
                Category
              </label>
              <select
                id="tkt-cat"
                className="min-h-[44px] w-full rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5 text-sm text-ink focus:border-primary-500 focus:bg-surface focus:outline-none"
                {...register('category')}
              >
                <option value="Technical Setup">Technical Setup</option>
                <option value="Audio & Capture">Audio &amp; Capture</option>
                <option value="Billing & Credits">Billing &amp; Credits</option>
                <option value="Account">Account</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tkt-desc" className="block text-sm font-medium text-ink">
                Description
              </label>
              <textarea
                id="tkt-desc"
                rows={4}
                placeholder="Include your OS version, meeting app (Zoom/Meet/Teams), and steps to reproduce..."
                className="w-full rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-primary-500 focus:bg-surface focus:outline-none"
                {...register('description')}
              />
              {errors.description && (
                <p role="alert" className="text-xs font-medium text-rose-500">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2 text-xs font-medium text-ink-muted hover:border-border-strong hover:text-ink">
                <Paperclip className="h-4 w-4 text-primary-500" />
                <span>{attachmentName || 'Attach screenshot or log'}</span>
                <input
                  type="file"
                  className="sr-only"
                  onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || '')}
                />
              </label>

              <Button type="submit" loading={isSubmitting}>
                <Send className="h-4 w-4" />
                Submit Ticket
              </Button>
            </div>
          </form>
        </Card>

        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-base font-bold text-ink">Past Tickets</h2>
          {tickets.length === 0 ? (
            <EmptyState
              icon={<LifeBuoy className="h-5 w-5" />}
              title="No support tickets yet"
              description="Submitted tickets and replies appear here."
            />
          ) : (
            tickets.map((t) => (
              <Card key={t.id} padding="sm" className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-ink-faint">{t.id}</span>
                  <Badge
                    variant={
                      t.status === 'Resolved' ? 'success' : t.status === 'In Progress' ? 'primary' : 'warning'
                    }
                  >
                    {t.status}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-ink">{t.subject}</p>
                <p className="text-xs leading-relaxed text-ink-muted">{t.description}</p>
                <div className="flex items-center justify-between border-t border-border-subtle pt-2 text-[11px] font-mono text-ink-faint">
                  <span>{t.category}</span>
                  <span>{t.createdAt}</span>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
