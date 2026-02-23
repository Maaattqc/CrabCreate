import { useState, useEffect } from 'react';
import { X, Plus, Pencil, Trash2, Play, FileText, Loader2 } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { useTemplates } from '../../hooks/useTemplates';
import { PRIORITIES, TEMPLATES } from '../../constants';
import VoiceInput from '../common/VoiceInput';
import VoiceTextarea from '../common/VoiceTextarea';
import type { TicketTemplate } from '../../types';

interface TemplateManagerProps {
  onClose: () => void;
  onApplyTemplate: (template: TicketTemplate) => void;
}

interface FormState {
  name: string;
  title_template: string;
  description_template: string;
  priority: string;
  template: string;
  tags: string;
}

const emptyForm: FormState = {
  name: '',
  title_template: '',
  description_template: '',
  priority: 'medium',
  template: 'feature',
  tags: '',
};

export default function TemplateManager({ onClose, onApplyTemplate }: TemplateManagerProps) {
  const { t } = useLanguage();
  const { templates, loading, fetch, create, update, remove } = useTemplates();
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    fetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setMode('create');
  };

  const handleEdit = (tpl: TicketTemplate) => {
    setForm({
      name: tpl.name,
      title_template: tpl.title_template,
      description_template: tpl.description_template,
      priority: tpl.priority,
      template: tpl.template,
      tags: tpl.tags || '',
    });
    setEditingId(tpl.id);
    setMode('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (mode === 'edit' && editingId) {
        await update(editingId, form);
      } else {
        await create(form);
      }
      setMode('list');
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await remove(id);
    } catch { /* ignore */ }
    setDeleteConfirm(null);
  };

  const getPriorityLabel = (id: string) => PRIORITIES.find(p => p.id === id)?.label || id;
  const getPriorityColor = (id: string) => PRIORITIES.find(p => p.id === id)?.color || '#eab308';
  const getTemplateLabel = (id: string) => TEMPLATES.find(tp => tp.id === id)?.label || id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-overlay backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-th-border-strong rounded-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-th-border shrink-0">
          <h2 className="text-base font-semibold text-tx-primary">{t.ticketTemplates}</h2>
          <button onClick={onClose} className="text-tx-faint hover:text-tx-tertiary"><X size={18} /></button>
        </div>

        {mode === 'list' ? (
          <div className="flex-1 overflow-y-auto">
            {/* Create button */}
            <div className="px-4 sm:px-6 pt-4 pb-2">
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors"
              >
                <Plus size={14} />
                {t.templateCreate}
              </button>
            </div>

            {/* Template list */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="text-tx-faint animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <FileText size={32} className="text-tx-ghost" />
                <p className="text-sm text-tx-faint">{t.templateEmpty}</p>
              </div>
            ) : (
              <div className="px-4 sm:px-6 pb-4 space-y-2">
                {templates.map(tpl => (
                  <div key={tpl.id} className="border border-th-border rounded-lg p-3 hover:border-th-border-strong transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-tx-primary">{tpl.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onApplyTemplate(tpl)}
                          className="p-1.5 rounded-md text-green-400 hover:bg-green-500/10 transition-colors"
                          title={t.templateApply}
                        >
                          <Play size={13} />
                        </button>
                        <button
                          onClick={() => handleEdit(tpl)}
                          className="p-1.5 rounded-md text-tx-faint hover:bg-subtle-hover transition-colors"
                          title={t.templateEdit}
                        >
                          <Pencil size={13} />
                        </button>
                        {deleteConfirm === tpl.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(tpl.id)}
                              className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                              {t.confirmYes}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 rounded text-xs text-tx-faint hover:bg-subtle-hover transition-colors"
                            >
                              {t.confirmNo}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(tpl.id)}
                            className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
                            title={t.templateDelete}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-tx-faint space-y-0.5">
                      {tpl.title_template && <p className="truncate">{tpl.title_template}</p>}
                      {tpl.description_template && <p className="truncate text-tx-ghost">{tpl.description_template}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ color: getPriorityColor(tpl.priority), backgroundColor: getPriorityColor(tpl.priority) + '15' }}>
                          {getPriorityLabel(tpl.priority)}
                        </span>
                        <span className="text-[10px] font-mono text-tx-ghost">{getTemplateLabel(tpl.template)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Create / Edit form */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <h3 className="text-sm font-semibold text-tx-primary">
              {mode === 'edit' ? t.templateEdit : t.templateCreate}
            </h3>

            {/* Name */}
            <div>
              <label className="block text-xs text-tx-muted mb-1">{t.templateName}</label>
              <VoiceInput
                value={form.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-subtle border border-th-border-strong rounded-lg px-3 py-2 text-sm text-tx-secondary focus:outline-none focus:border-amber-500/50"
                placeholder={t.templateName}
              />
            </div>

            {/* Title template */}
            <div>
              <label className="block text-xs text-tx-muted mb-1">{t.titleLabel}</label>
              <VoiceInput
                value={form.title_template}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, title_template: e.target.value }))}
                className="w-full bg-subtle border border-th-border-strong rounded-lg px-3 py-2 text-sm text-tx-secondary focus:outline-none focus:border-amber-500/50"
                placeholder={t.titlePlaceholder}
              />
            </div>

            {/* Description template */}
            <div>
              <label className="block text-xs text-tx-muted mb-1">{t.descriptionLabel}</label>
              <VoiceTextarea
                value={form.description_template}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, description_template: e.target.value }))}
                className="w-full bg-subtle border border-th-border-strong rounded-lg px-3 py-2 text-sm text-tx-secondary focus:outline-none focus:border-amber-500/50 h-20 resize-none"
                placeholder={t.descriptionPlaceholder}
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs text-tx-muted mb-1">{t.filterPriority}</label>
              <select
                value={form.priority}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-subtle border border-th-border-strong rounded-lg px-3 py-2 text-sm text-tx-secondary focus:outline-none focus:border-amber-500/50"
              >
                {PRIORITIES.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Template type */}
            <div>
              <label className="block text-xs text-tx-muted mb-1">Template</label>
              <select
                value={form.template}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, template: e.target.value }))}
                className="w-full bg-subtle border border-th-border-strong rounded-lg px-3 py-2 text-sm text-tx-secondary focus:outline-none focus:border-amber-500/50"
              >
                {TEMPLATES.map(tp => (
                  <option key={tp.id} value={tp.id}>{tp.icon} {tp.label}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMode('list')}
                className="px-4 py-2 rounded-lg text-sm text-tx-faint hover:bg-subtle-hover transition-colors"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? t.saving : t.save}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
