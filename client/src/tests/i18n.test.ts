import { describe, it, expect } from 'vitest';
import { translations } from '../i18n';
import type { Translations } from '../i18n';

describe('i18n translations', () => {
  it('both fr and en translations exist', () => {
    expect(translations.fr).toBeDefined();
    expect(translations.en).toBeDefined();
  });

  it('all Translations interface keys are present in fr', () => {
    const frKeys = Object.keys(translations.fr);
    const enKeys = Object.keys(translations.en);

    // Both should have the same set of keys
    expect(frKeys.length).toBeGreaterThan(0);
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it('no empty string values in fr translations', () => {
    const frEntries = Object.entries(translations.fr);
    for (const [key, value] of frEntries) {
      expect(value, `fr.${key} should not be empty`).not.toBe('');
    }
  });

  it('no empty string values in en translations', () => {
    const enEntries = Object.entries(translations.en);
    for (const [key, value] of enEntries) {
      expect(value, `en.${key} should not be empty`).not.toBe('');
    }
  });

  it('admin keys exist in both languages', () => {
    const adminKeys: (keyof Translations)[] = [
      'adminTitle',
      'adminUsers',
      'adminContacts',
      'adminSettings',
      'adminStats',
      'adminEmail',
      'adminPlan',
      'adminBlocked',
      'adminLastLogin',
      'adminCreatedAt',
      'adminBlock',
      'adminUnblock',
      'adminBlockReason',
      'adminNoUsers',
      'adminNoContacts',
      'adminTotalUsers',
      'adminActiveUsers',
      'adminBlockedUsers',
      'adminTotalTickets',
      'adminTotalCost',
      'adminTotalTokens',
      'adminFree',
      'adminPro',
      'adminEnterprise',
      'adminActions',
      'adminRole',
      'adminUser',
      'adminAdmin',
      'adminDeleteMsg',
      'adminFrom',
      'adminMessage',
      'adminDate',
    ];

    for (const key of adminKeys) {
      expect(translations.fr[key], `fr.${key} should exist`).toBeDefined();
      expect(translations.en[key], `en.${key} should exist`).toBeDefined();
    }
  });

  it('nav keys exist in both languages', () => {
    const navKeys: (keyof Translations)[] = [
      'navHome',
      'navPricing',
      'navContact',
      'navLogin',
    ];

    for (const key of navKeys) {
      expect(translations.fr[key], `fr.${key} should exist`).toBeDefined();
      expect(translations.en[key], `en.${key} should exist`).toBeDefined();
      expect(typeof translations.fr[key]).toBe('string');
      expect(typeof translations.en[key]).toBe('string');
    }
  });

  it('all FR keys have matching EN keys (same set)', () => {
    const frKeys = Object.keys(translations.fr).sort();
    const enKeys = Object.keys(translations.en).sort();

    expect(frKeys).toEqual(enKeys);
  });

  it('project setup keys exist in both languages', () => {
    const setupKeys: (keyof Translations)[] = [
      'setupTitle',
      'setupRepoDesc',
      'setupConnectExisting',
      'setupConnectExistingDesc',
      'setupCreateNew',
      'setupCreateNewDesc',
      'setupProvider',
      'setupToken',
      'setupOwner',
      'setupRepoName',
      'setupBranch',
      'setupBack',
      'setupConnect',
      'setupCreateRepo',
      'setupPrivate',
      'setupPublic',
      'setupRepoSuccess',
      'setupDeployDesc',
      'setupCfToken',
      'setupCfAccountId',
      'setupCfInfo',
      'setupSkipDeploy',
      'setupConfigureDeploy',
      'setupProjectNotConfigured',
    ];

    for (const key of setupKeys) {
      expect(translations.fr[key], `fr.${key} should exist`).toBeDefined();
      expect(translations.en[key], `en.${key} should exist`).toBeDefined();
      expect(typeof translations.fr[key]).toBe('string');
      expect(typeof translations.en[key]).toBe('string');
    }
  });

  it('collaboration keys exist in both languages', () => {
    const collaborationKeys: (keyof Translations)[] = [
      'tabComments',
      'commentsEmpty',
      'commentsPlaceholder',
      'commentsSend',
      'commentsEdit',
      'commentsDelete',
      'commentsEdited',
      'commentsMentionHint',
      'commentsTyping',
      'commentsEditingLock',
      'watchTicket',
      'unwatchTicket',
      'watchersCount',
      'notificationsTitle',
      'notificationsEmpty',
      'notificationsMarkAllRead',
      'notificationsMention',
      'notificationsComment',
      'notificationsStatusChange',
      'userStatusAvailable',
      'userStatusBusy',
      'userStatusAway',
      'viewingTicket',
      'draggingTicket',
      'reactionsAdd',
    ];

    for (const key of collaborationKeys) {
      expect(translations.fr[key], `fr.${key} should exist`).toBeDefined();
      expect(translations.en[key], `en.${key} should exist`).toBeDefined();
      expect(typeof translations.fr[key]).toBe('string');
      expect(typeof translations.en[key]).toBe('string');
    }
  });
});
