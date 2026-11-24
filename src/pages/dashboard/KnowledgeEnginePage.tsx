import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, Pencil, Trash2, Upload, BookOpen } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { INITIAL_KNOWLEDGE, type KnowledgeEntry } from '../../data/dashboard';
import { knowledgeEntrySchema, type KnowledgeEntryFormValues } from '../../lib/schemas';
import { useToast } from '../../lib/toast';
import { usePageMeta } from '../../lib/seo';

export default function KnowledgeEnginePage() {
  usePageMeta({
    title: 'Knowledge Engine — Crackpilot',
    description: 'Store custom Q&A pairs, STAR stories, and architecture notes so Crackpilot surfaces your exact points live.',
  });

  const { toast } = useToast();
  const [entries, setEntries] = useState<KnowledgeEntry[]>(INITIAL_KNOWLEDGE);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<KnowledgeEntryFormValues>({
    resolver: zodResolver(knowledgeEntrySchema),
    defaultValues: { question: '', answer: '', category: 'Behavioral' },
  });

  useEffect(() => {
    fetch('/api/knowledge', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.entries)) setEntries(data.entries);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return entries.filter((item) => {
      const matchesCat = categoryFilter === 'All' || item.category === categoryFilter;
      const q = query.trim().toLowerCase();
      const matchesText =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesCat && matchesText;
    });
  }, [entries, query, categoryFilter]);

  const openAdd = () => {
    setEditing(null);
    reset({ question: '', answer: '', category: 'Behavioral' });
    setModalOpen(true);
  };

  const openEdit = (entry: KnowledgeEntry) => {
    setEditing(entry);
    reset({
      question: entry.question,
      answer: entry.answer,
      category: entry.category,
    });
    setModalOpen(true);
  };

  const onSaveEntry = async (values: KnowledgeEntryFormValues) => {
    try {
      const url = editing ? `/api/knowledge/${editing.id}` : '/api/knowledge';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.entries)) {
        setEntries(data.entries);
        setModalOpen(false);
        toast({
          title: editing ? 'Q&A updated' : 'Q&A added to Knowledge Engine',
          description: 'Synced immediately for your next live session.',
        });
      }
    } catch {
      toast({ title: 'Save failed', description: 'Check your connection.', variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.entries)) {
        setEntries(data.entries);
        toast({ title: 'Entry removed', variant: 'info' });
      }
    } catch {
      toast({ title: 'Delete failed', variant: 'error' });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let importedCount = 0;
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          for (const row of parsed.slice(0, 10)) {
            if (row.question && row.answer) {
              const res = await fetch('/api/knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  question: row.question,
                  answer: row.answer,
                  category: row.category || 'General',
                }),
              });
              const d = await res.json();
              if (res.ok && Array.isArray(d.entries)) {
                setEntries(d.entries);
                importedCount += 1;
              }
            }
          }
        }
      } else {
        const blocks = text.split(/\n\s*\n/).filter(Boolean);
        for (const block of blocks.slice(0, 5)) {
          const [qLine, ...rest] = block.split('\n');
          if (qLine && rest.length > 0) {
            const res = await fetch('/api/knowledge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                question: qLine.replace(/^Q:\s*/i, ''),
                answer: rest.join(' ').replace(/^A:\s*/i, ''),
                category: 'General',
              }),
            });
            const d = await res.json();
            if (res.ok && Array.isArray(d.entries)) {
              setEntries(d.entries);
              importedCount += 1;
            }
          }
        }
      }
      toast({
        title: importedCount > 0 ? `Imported ${importedCount} Q&A entries` : 'No valid Q&A pairs found',
        description: importedCount > 0 ? 'Entries are ready in your Knowledge Engine.' : 'Use JSON [{question, answer}] or blank-line separated Q/A text.',
        variant: importedCount > 0 ? 'success' : 'info',
      });
    } catch {
      toast({ title: 'Import failed', description: 'Could not parse uploaded file.', variant: 'error' });
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">Knowledge Engine</h1>
          <p className="text-sm text-ink-muted">
            Pre-load your STAR stories, metrics, and preferred technical answers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-elevated">
            <Upload className="h-4 w-4 text-primary-500" />
            Import file
            <input type="file" accept=".json,.txt,.md" className="sr-only" onChange={handleImportFile} />
          </label>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Q&amp;A
          </Button>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved questions or keywords..."
            aria-label="Search Knowledge Engine"
            className="min-h-[44px] w-full rounded-xl border border-border-subtle bg-surface pl-10 pr-4 text-sm text-ink placeholder:text-ink-faint focus:border-primary-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {['All', 'Behavioral', 'Technical', 'System Design', 'Leadership', 'General'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-primary-500 text-white'
                  : 'bg-surface border border-border-subtle text-ink-muted hover:text-ink'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Entries List or Empty State */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title={entries.length === 0 ? 'No saved answers yet' : 'No matching Q&A entries'}
          description={
            entries.length === 0
              ? 'Add your first behavioral story or project deep-dive so Crackpilot surfaces your exact framing live.'
              : 'Try a different search keyword or switch the category filter.'
          }
          action={
            entries.length === 0 ? (
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add first Q&amp;A
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('');
                  setCategoryFilter('All');
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <Card key={entry.id} className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint font-mono">
                    <span className="text-primary-500 dark:text-lavender-200">{entry.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>Updated {entry.updatedAt}</span>
                  </div>
                  <h2 className="text-base font-bold text-ink">{entry.question}</h2>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(entry)}
                    aria-label={`Edit ${entry.question}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-elevated hover:text-ink cursor-pointer"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    aria-label={`Delete ${entry.question}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-rose-500/15 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-ink-muted">{entry.answer}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Knowledge Entry' : 'Add Custom Q&A'}
        description="When a similar question is detected live, Crackpilot prioritizes these talking points."
      >
        <form onSubmit={handleSubmit(onSaveEntry)} noValidate className="space-y-4">
          <Input
            label="Interview question"
            placeholder="e.g., Tell me about a difficult production outage you resolved."
            error={errors.question?.message}
            {...register('question')}
          />

          <div className="space-y-1.5">
            <label htmlFor="qa-cat" className="block text-sm font-medium text-ink">
              Category
            </label>
            <select
              id="qa-cat"
              className="min-h-[44px] w-full rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5 text-sm text-ink focus:border-primary-500 focus:bg-surface focus:outline-none"
              {...register('category')}
            >
              <option value="Behavioral">Behavioral</option>
              <option value="Technical">Technical</option>
              <option value="System Design">System Design</option>
              <option value="Leadership">Leadership</option>
              <option value="General">General</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="qa-ans" className="block text-sm font-medium text-ink">
              Preferred talking points
            </label>
            <textarea
              id="qa-ans"
              rows={5}
              placeholder="Write concise bullets or STAR metrics you want surfaced..."
              className="w-full rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-primary-500 focus:bg-surface focus:outline-none"
              {...register('answer')}
            />
            {errors.answer && (
              <p role="alert" className="text-xs font-medium text-rose-500">
                {errors.answer.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editing ? 'Update Entry' : 'Save Q&A'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
