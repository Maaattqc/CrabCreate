import { useState } from 'react';
import { X, Pencil, Trash2, Plus } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import type { Label } from '../../types';

interface LabelManagerProps {
  labels: Label[];
  onCreateLabel: (data: { name: string; color: string }) => Promise<Label>;
  onUpdateLabel: (id: number, data: { name?: string; color?: string }) => Promise<Label>;
  onDeleteLabel: (id: number) => Promise<void>;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

export default function LabelManager({ labels, onCreateLabel, onUpdateLabel, onDeleteLabel, onClose }: LabelManagerProps) {
  const { t } = useLanguage();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim() || loading) return;
    setLoading(true);
    try {
      await onCreateLabel({ name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor(PRESET_COLORS[0]);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim() || loading) return;
    setLoading(true);
    try {
      await onUpdateLabel(id, { name: editName.trim(), color: editColor });
      setEditingId(null);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (loading) return;
    setLoading(true);
    try {
      await onDeleteLabel(id);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const startEdit = (label: Label) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-overlay backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-th-border-strong rounded-xl w-full max-w-md mx-4 shadow-2xl shadow-black/40"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <h2 className="text-base font-semibold text-tx-primary">{t.labels}</h2>
          <button onClick={onClose} className="text-tx-faint hover:text-tx-tertiary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Label list */}
        <div className="p-4 space-y-1 max-h-64 overflow-y-auto">
          {labels.length === 0 && (
            <p className="text-xs text-tx-faint text-center py-4">{t.labelNone}</p>
          )}

          {labels.map(label => (
            <div key={label.id}>
              {editingId === label.id ? (
                /* Editing mode */
                <div className="flex flex-col gap-2 p-3 bg-subtle rounded-lg border border-th-border">
                  <div className="flex items-center gap-2">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 bg-card border border-th-border-strong rounded-lg px-3 py-1.5 text-sm text-tx-secondary focus:outline-none focus:border-amber-500/50"
                      placeholder={t.labelName}
                      maxLength={50}
                    />
                    <button
                      onClick={() => handleUpdate(label.id)}
                      disabled={!editName.trim()}
                      className="px-3 py-1.5 text-xs font-medium bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 disabled:opacity-40 transition-colors"
                    >
                      {t.save}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1.5 text-xs text-tx-faint hover:text-tx-tertiary transition-colors"
                    >
                      {t.cancel}
                    </button>
                  </div>
                  {/* Color picker */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-tx-faint mr-1">{t.labelColor}</span>
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${
                          editColor === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                /* Display mode */
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-subtle-hover group transition-colors">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                  <span className="flex-1 text-sm text-tx-secondary truncate">{label.name}</span>
                  <button
                    onClick={() => startEdit(label)}
                    className="p-1 rounded text-tx-faint opacity-0 group-hover:opacity-100 hover:text-amber-400 transition-all"
                    title={t.labelEdit}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(label.id)}
                    className="p-1 rounded text-tx-faint opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                    title={t.labelDelete}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Create form */}
        <div className="px-4 pb-4 pt-2 border-t border-th-border">
          <p className="text-xs text-tx-faint mb-2 font-medium">{t.labelCreate}</p>
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              className="flex-1 bg-subtle border border-th-border-strong rounded-lg px-3 py-1.5 text-sm text-tx-secondary focus:outline-none focus:border-amber-500/50"
              placeholder={t.labelName}
              maxLength={50}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || loading}
              className="p-2 bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 disabled:opacity-40 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          {/* Color picker */}
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="text-[11px] text-tx-faint mr-1">{t.labelColor}</span>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${
                  newColor === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
