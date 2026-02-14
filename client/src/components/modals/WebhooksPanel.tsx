import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Globe, X, Check, Loader2 } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import * as webhooksApi from '../../api/webhooks';
import type { UserWebhook } from '../../types';

interface WebhooksPanelProps {
  projectId: number;
}

const AVAILABLE_EVENTS = [
  'ticket:created',
  'ticket:updated',
  'ticket:status_changed',
  'pipeline:completed',
  'comment:added',
] as const;

export default function WebhooksPanel({ projectId }: WebhooksPanelProps) {
  const { t } = useLanguage();
  const [webhooks, setWebhooks] = useState<UserWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createUrl, setCreateUrl] = useState('');
  const [createEvents, setCreateEvents] = useState<string[]>([]);
  const [createSecret, setCreateSecret] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editEvents, setEditEvents] = useState<string[]>([]);
  const [editSecret, setEditSecret] = useState('');

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    loadWebhooks();
  }, [projectId]);

  async function loadWebhooks() {
    setLoading(true);
    try {
      const data = await webhooksApi.getWebhooks();
      setWebhooks(data);
    } catch {
      setError(t.error);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createUrl.trim() || createEvents.length === 0) return;
    setCreating(true);
    setError('');
    try {
      const webhook = await webhooksApi.createWebhook({
        url: createUrl.trim(),
        events: createEvents,
        secret: createSecret.trim() || undefined,
      });
      setWebhooks(prev => [...prev, webhook]);
      setShowCreate(false);
      setCreateUrl('');
      setCreateEvents([]);
      setCreateSecret('');
    } catch (err) {
      setError((err as Error).message);
    }
    setCreating(false);
  }

  async function handleToggleEnabled(webhook: UserWebhook) {
    try {
      const updated = await webhooksApi.updateWebhook(webhook.id, {
        enabled: webhook.enabled ? 0 : 1,
      });
      setWebhooks(prev => prev.map(w => w.id === webhook.id ? updated : w));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function startEdit(webhook: UserWebhook) {
    setEditingId(webhook.id);
    setEditUrl(webhook.url);
    setEditEvents(webhook.events ? webhook.events.split(',') : []);
    setEditSecret(webhook.secret || '');
  }

  async function handleSaveEdit() {
    if (editingId === null || !editUrl.trim()) return;
    setError('');
    try {
      const updated = await webhooksApi.updateWebhook(editingId, {
        url: editUrl.trim(),
        events: editEvents.join(','),
        secret: editSecret.trim() || null,
      });
      setWebhooks(prev => prev.map(w => w.id === editingId ? updated : w));
      setEditingId(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(id: number) {
    setError('');
    try {
      await webhooksApi.deleteWebhook(id);
      setWebhooks(prev => prev.filter(w => w.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function toggleEvent(events: string[], event: string, setter: (events: string[]) => void) {
    if (events.includes(event)) {
      setter(events.filter(e => e !== event));
    } else {
      setter([...events, event]);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="text-tx-faint animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-amber-400" />
          <h3 className="text-sm font-semibold text-tx-primary">{t.webhooks}</h3>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 rounded-lg hover:bg-amber-500/20 transition-colors"
          >
            <Plus size={12} />
            {t.webhookCreate}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="border border-th-border rounded-lg p-4 space-y-3 bg-subtle">
          <div>
            <label className="text-xs font-medium text-tx-secondary block mb-1">{t.webhookUrl}</label>
            <input
              type="url"
              value={createUrl}
              onChange={e => setCreateUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              required
              className="w-full bg-card border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-tx-secondary block mb-1">{t.webhookEvents}</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_EVENTS.map(event => (
                <button
                  key={event}
                  type="button"
                  onClick={() => toggleEvent(createEvents, event, setCreateEvents)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                    createEvents.includes(event)
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                      : 'border-th-border text-tx-faint hover:text-tx-secondary hover:bg-subtle-hover'
                  }`}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-tx-secondary block mb-1">{t.webhookSecret}</label>
            <input
              type="text"
              value={createSecret}
              onChange={e => setCreateSecret(e.target.value)}
              placeholder="Optional"
              className="w-full bg-card border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 text-xs font-medium text-tx-faint hover:text-tx-secondary transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={creating || !createUrl.trim() || createEvents.length === 0}
              className="px-4 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {creating ? t.creating : t.webhookCreate}
            </button>
          </div>
        </form>
      )}

      {/* Webhooks list */}
      {webhooks.length === 0 && !showCreate ? (
        <div className="text-center py-8">
          <Globe size={32} className="mx-auto mb-2 text-tx-ghost opacity-50" />
          <p className="text-sm text-tx-ghost">{t.webhookEmpty}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map(webhook => {
            const events = webhook.events ? webhook.events.split(',') : [];
            const isEditing = editingId === webhook.id;

            if (isEditing) {
              return (
                <div key={webhook.id} className="border border-amber-500/30 rounded-lg p-4 space-y-3 bg-subtle">
                  <div>
                    <label className="text-xs font-medium text-tx-secondary block mb-1">{t.webhookUrl}</label>
                    <input
                      type="url"
                      value={editUrl}
                      onChange={e => setEditUrl(e.target.value)}
                      className="w-full bg-card border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-tx-secondary block mb-1">{t.webhookEvents}</label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_EVENTS.map(event => (
                        <button
                          key={event}
                          type="button"
                          onClick={() => toggleEvent(editEvents, event, setEditEvents)}
                          className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                            editEvents.includes(event)
                              ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                              : 'border-th-border text-tx-faint hover:text-tx-secondary hover:bg-subtle-hover'
                          }`}
                        >
                          {event}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-tx-secondary block mb-1">{t.webhookSecret}</label>
                    <input
                      type="text"
                      value={editSecret}
                      onChange={e => setEditSecret(e.target.value)}
                      placeholder="Optional"
                      className="w-full bg-card border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs font-medium text-tx-faint hover:text-tx-secondary transition-colors"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      <Check size={12} />
                      {t.save}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={webhook.id} className="border border-th-border rounded-lg p-3 hover:border-th-border-strong transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-tx-primary font-mono truncate">{webhook.url}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {/* Enabled toggle */}
                    <button
                      onClick={() => handleToggleEnabled(webhook)}
                      className={`w-8 h-4.5 rounded-full transition-all duration-200 relative flex-shrink-0 ${
                        webhook.enabled ? 'bg-green-500' : 'bg-tx-ghost'
                      }`}
                      title={t.webhookEnabled}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full shadow transition-transform duration-200 ${
                          webhook.enabled ? 'translate-x-3.5 bg-white' : 'translate-x-0 bg-gray-300'
                        }`}
                      />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => startEdit(webhook)}
                      className="p-1 text-tx-faint hover:text-amber-400 transition-colors"
                      title={t.webhookEdit}
                    >
                      <Pencil size={13} />
                    </button>

                    {/* Delete */}
                    {confirmDeleteId === webhook.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(webhook.id)}
                          className="px-2 py-0.5 text-[10px] font-medium text-red-400 bg-red-500/10 rounded hover:bg-red-500/20 transition-colors"
                        >
                          {t.confirmYes}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="p-0.5 text-tx-faint hover:text-tx-secondary"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(webhook.id)}
                        className="p-1 text-tx-faint hover:text-red-400 transition-colors"
                        title={t.webhookDelete}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Events badges */}
                <div className="flex flex-wrap gap-1">
                  {events.map(event => (
                    <span key={event} className="text-[10px] px-2 py-0.5 rounded-full bg-subtle border border-th-border text-tx-faint">
                      {event}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
