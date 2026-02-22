import type { Column, Priority, Template, AIModel } from '../types';

export const COLUMNS: Column[] = [
  { id: 'backlog', label: 'Tâches', color: '#94a3b8' },
  { id: 'queued', label: 'En Attente', color: '#fb923c' },
  { id: 'estimating', label: 'Estimation', color: '#22d3ee' },
  { id: 'ai_coding', label: 'AI Coding', color: '#facc15' },
  { id: 'ai_review', label: 'AI Review', color: '#a78bfa' },
  { id: 'testing', label: 'AI Tests', color: '#2dd4bf' },
  { id: 'deploying', label: 'Déploiement', color: '#60a5fa' },
  { id: 'staging', label: 'Staging', color: '#38bdf8' },
  { id: 'review', label: 'Review', color: '#c084fc' },
  { id: 'approved', label: 'Approuvé', color: '#4ade80' },
  { id: 'rejected', label: 'Rejeté', color: '#f87171' },
];

export const PRIORITIES: Priority[] = [
  { id: 'critical', label: 'Critique', color: '#ef4444' },
  { id: 'high', label: 'Haute', color: '#f97316' },
  { id: 'medium', label: 'Moyenne', color: '#eab308' },
  { id: 'low', label: 'Basse', color: '#22c55e' },
];

export const TEMPLATES: Template[] = [
  { id: 'feature', label: 'Feature', icon: '✦' },
  { id: 'bugfix', label: 'Bugfix', icon: '⊘' },
  { id: 'refactor', label: 'Refactor', icon: '↻' },
  { id: 'ui', label: 'UI', icon: '◧' },
  { id: 'perf', label: 'Perf', icon: '⚡' },
  { id: 'security', label: 'Security', icon: '⛨' },
];

export const AI_MODELS: AIModel[] = [
  { id: 'gpt', label: 'GPT-5.3' },
  { id: 'claude', label: 'Claude Opus 4.6' },
];

const COLUMN_LABEL_KEYS: Record<string, string> = {
  backlog: 'colTasks',
  queued: 'colWaiting',
  estimating: 'colEstimation',
  ai_coding: 'colAiCoding',
  ai_review: 'colAiReview',
  testing: 'colAiTests',
  deploying: 'colDeploy',
  staging: 'colStaging',
  review: 'colReview',
  approved: 'colApproved',
  rejected: 'colRejected',
};

export function getColumnLabel(status: string, t?: Record<string, string>): string {
  if (t && COLUMN_LABEL_KEYS[status]) {
    return t[COLUMN_LABEL_KEYS[status]] || COLUMNS.find(c => c.id === status)?.label || status;
  }
  return COLUMNS.find(c => c.id === status)?.label || status;
}

export function getColumnColor(status: string): string {
  return COLUMNS.find(c => c.id === status)?.color || '#64748b';
}

export function getPriorityColor(priority: string): string {
  return PRIORITIES.find(p => p.id === priority)?.color || '#eab308';
}
