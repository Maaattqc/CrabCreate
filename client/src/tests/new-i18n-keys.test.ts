import { describe, it, expect } from 'vitest';
import { translations } from '../i18n';
import type { Translations } from '../i18n';

describe('New feature i18n keys', () => {
  const newKeys: (keyof Translations)[] = [
    // Filters
    'filterStatus', 'filterPriority', 'filterAssignee', 'filterDueDate', 'filterLabel', 'filterClear', 'filterAll',
    // Due dates
    'dueDate', 'dueDateSet', 'dueDateClear', 'dueDateOverdue', 'dueDateToday', 'dueDateNone',
    // Labels
    'labels', 'labelCreate', 'labelEdit', 'labelDelete', 'labelColor', 'labelName', 'labelNone',
    // Subtasks
    'subtasks', 'subtaskAdd', 'subtaskPlaceholder', 'subtaskProgress', 'subtaskEmpty',
    'subtaskAiBadge', 'subtaskCoding', 'subtaskDecomposed',
    // Favorites
    'favorites', 'favoriteAdd', 'favoriteRemove', 'favoritesEmpty',
    // Templates
    'ticketTemplates', 'templateCreate', 'templateEdit', 'templateDelete', 'templateApply', 'templateName', 'templateEmpty',
    // Global search
    'globalSearch', 'searchResults', 'searchNoResults', 'searchTickets', 'searchComments', 'searchActivity',
    // Keyboard shortcuts
    'keyboardShortcuts', 'shortcutNewTicket', 'shortcutSearch', 'shortcutNextTicket', 'shortcutPrevTicket',
    // Activity
    'activityPage', 'activityGlobal', 'activityEmpty', 'activityFilter',
    // Markdown
    'markdownPreview', 'markdownEdit', 'markdownHelp',
    // Export
    'exportCSV', 'exportPDF', 'exportTitle',
    // Webhooks
    'webhooks', 'webhookCreate', 'webhookEdit', 'webhookDelete', 'webhookUrl', 'webhookEvents', 'webhookSecret', 'webhookEnabled', 'webhookEmpty',
    // Views
    'viewCalendar', 'viewTimeline', 'viewBoard', 'viewList',
    // Email
    'emailNotifications', 'emailMention', 'emailStatusChange',
    // Voice input
    'micStart', 'micStop', 'micNotSupported', 'micErrorNoSpeech', 'micErrorNotAllowed', 'micErrorGeneric', 'micListening',
  ];

  it('all new keys exist in FR translations', () => {
    for (const key of newKeys) {
      expect(translations.fr[key], `fr.${key} missing`).toBeDefined();
      expect(typeof translations.fr[key], `fr.${key} should be string`).toBe('string');
    }
  });

  it('all new keys exist in EN translations', () => {
    for (const key of newKeys) {
      expect(translations.en[key], `en.${key} missing`).toBeDefined();
      expect(typeof translations.en[key], `en.${key} should be string`).toBe('string');
    }
  });

  it('no empty values in new FR keys', () => {
    for (const key of newKeys) {
      expect(translations.fr[key], `fr.${key} empty`).not.toBe('');
    }
  });

  it('no empty values in new EN keys', () => {
    for (const key of newKeys) {
      expect(translations.en[key], `en.${key} empty`).not.toBe('');
    }
  });

  it('FR and EN have same number of total keys', () => {
    const frKeys = Object.keys(translations.fr);
    const enKeys = Object.keys(translations.en);
    expect(frKeys.length).toBe(enKeys.length);
  });

  it('every FR key has a corresponding EN key', () => {
    const frKeys = Object.keys(translations.fr) as (keyof Translations)[];
    for (const key of frKeys) {
      expect(translations.en[key], `en.${key} missing but exists in fr`).toBeDefined();
    }
  });
});
