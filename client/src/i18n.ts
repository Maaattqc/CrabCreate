export type Lang = 'fr' | 'en';

export interface Translations {
  // Header
  credit: string;
  tokens: string;
  lines: string;
  score: string;
  search: string;
  lightMode: string;
  darkMode: string;
  settings: string;

  // Board
  empty: string;
  loading: string;
  newTicket: string;
  launchPipeline: string;
  editTicket: string;

  // Create modal
  createTitle: string;
  titleLabel: string;
  titlePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  aiModelLabel: string;
  cancel: string;
  continueBtn: string;
  create: string;
  creating: string;

  // Detail modal
  titleFieldLabel: string;
  titleFieldPlaceholder: string;
  descFieldLabel: string;
  descFieldPlaceholder: string;
  saving: string;
  approve: string;
  reject: string;
  retry: string;
  rollback: string;
  delete: string;
  archive: string;
  unarchive: string;

  // Tabs
  tabActivity: string;
  tabQuality: string;
  tabChat: string;
  tabLogs: string;
  tabCode: string;
  tabTests: string;

  // Ticket metadata
  ticketCreatedBy: string;
  ticketModifiedBy: string;
  ticketCreatedAt: string;
  ticketUpdatedAt: string;

  // Activity tab
  noActivity: string;

  // AI Review tab
  noReview: string;
  reviewScore: string;
  issues: string;
  noIssues: string;

  // Chat tab
  chatEmpty: string;
  chatPlaceholder: string;

  // Terminal tab
  noLogs: string;

  // Diff tab
  loadingDiff: string;
  noDiff: string;

  // Tests tab
  noTests: string;
  passed: string;
  failed: string;
  total: string;

  // Settings modal
  settingsTitle: string;
  maxPipelines: string;
  maxPipelinesDesc: string;
  maxRequests: string;
  maxRequestsDesc: string;
  maxTickets: string;
  maxTicketsDesc: string;
  language: string;
  languageDesc: string;
  save: string;
  savedOk: string;
  close: string;

  // Animations
  animations: string;
  animationsDesc: string;
  animationsOn: string;
  animationsOff: string;

  // AI Design
  aiDesign: string;
  aiDesignDesc: string;
  aiDesignOn: string;
  aiDesignOff: string;

  // Mascot
  mascot: string;
  mascotDesc: string;
  mascotOn: string;
  mascotOff: string;

  // Command palette
  cmdPlaceholder: string;
  cmdNoResults: string;
  cmdHint: string;

  // Confirm dialog
  confirmDeleteTitle: string;
  confirmDeleteMsg: string;
  confirmYes: string;
  confirmNo: string;

  // Onboarding
  onboardWelcome: string;
  onboardStep1: string;
  onboardStep2: string;
  onboardStep3: string;
  onboardStep4: string;
  onboardGo: string;
  onboardSkip: string;
  onboardNext: string;
  onboardQuickTour: string;
  onboardDemoTitle: string;
  onboardDemoDesc: string;
  onboardPipelineRunning: string;
  onboardPipelineQueued: string;
  onboardPipelineEstimating: string;
  onboardPipelineCoding: string;
  onboardPipelineReview: string;
  onboardPipelineTesting: string;
  onboardPipelineDeploying: string;
  onboardPipelineStaging: string;
  onboardPipelineWaitApprove: string;
  onboardPipelineApproved: string;
  onboardApproveQuestion: string;
  onboardApproveYes: string;
  onboardApproveNo: string;
  onboardCelebrationTitle: string;
  onboardCelebrationLink: string;
  onboardCompleteTitle: string;
  onboardCompleteDesc: string;
  onboardCompleteBtn: string;
  onboardFeedbackQuestion: string;

  // Auth
  authSubtitle: string;
  authEnterEmail: string;
  authSendCode: string;
  authBackToEmail: string;
  authCodeSentTo: string;
  authCodeExpiry: string;
  authVerify: string;
  authLogout: string;
  authVerified: string;
  authLoading: string;
  authLoggedAs: string;

  // Live bar
  liveIdle: string;
  liveWorking: string;

  // Notifications
  pipelineLaunched: string;
  error: string;

  // Public navbar
  navHome: string;
  navPricing: string;
  navContact: string;
  navLogin: string;

  // Landing page
  landingHero: string;
  landingHeroSub: string;
  landingCTA: string;
  landingFeature1Title: string;
  landingFeature1Desc: string;
  landingFeature2Title: string;
  landingFeature2Desc: string;
  landingFeature3Title: string;
  landingFeature3Desc: string;
  landingFeature4Title: string;
  landingFeature4Desc: string;
  landingHowTitle: string;
  landingStep1: string;
  landingStep1Desc: string;
  landingStep2: string;
  landingStep2Desc: string;
  landingStep3: string;
  landingStep3Desc: string;
  landingStep4: string;
  landingStep4Desc: string;

  // Comparison table
  comparisonTitle: string;
  comparisonSubtitle: string;
  compFeature: string;
  compAICoding: string;
  compAutoReview: string;
  compAutoTest: string;
  compAutoDeploy: string;
  compKanban: string;
  compRealtime: string;
  compSubtasks: string;
  compLabels: string;
  compDueDates: string;
  compCalendar: string;
  compTimeline: string;
  compTemplates: string;
  compSearch: string;
  compExport: string;
  compWebhooks: string;
  compKeyboardShortcuts: string;
  compMarkdown: string;
  compSelfHosted: string;
  compFreeTier: string;
  compPartial: string;
  compPaid: string;

  // Pricing page
  pricingTitle: string;
  pricingSub: string;
  pricingFree: string;
  pricingFreePrice: string;
  pricingPro: string;
  pricingProPrice: string;
  pricingEnterprise: string;
  pricingEnterprisePrice: string;
  pricingChoose: string;
  pricingContact: string;
  pricingFeatureTickets: string;
  pricingFeaturePipelines: string;
  pricingFeatureSupport: string;
  pricingFeaturePriority: string;
  pricingFeatureDedicated: string;
  pricingPerMonth: string;

  // Contact page
  contactTitle: string;
  contactSub: string;
  contactName: string;
  contactEmail: string;
  contactMessage: string;
  contactSend: string;
  contactSending: string;
  contactSuccess: string;

  // Legal pages
  legalTitle: string;
  privacyTitle: string;

  // 404 page
  notFoundTitle: string;
  notFoundDesc: string;
  notFoundBack: string;

  // Footer
  footerRights: string;
  footerLegal: string;
  footerPrivacy: string;

  // User menu
  userMenuTheme: string;
  userMenuLang: string;
  userMenuAnimations: string;
  userMenuAIDesign: string;
  userMenuMascot: string;
  userMenuSettings: string;

  // Admin
  adminTitle: string;
  adminUsers: string;
  adminContacts: string;
  adminSettings: string;
  adminStats: string;
  adminEmail: string;
  adminPlan: string;
  adminBlocked: string;
  adminLastLogin: string;
  adminCreatedAt: string;
  adminBlock: string;
  adminUnblock: string;
  adminBlockReason: string;
  adminNoUsers: string;
  adminNoContacts: string;
  adminTotalUsers: string;
  adminActiveUsers: string;
  adminBlockedUsers: string;
  adminTotalTickets: string;
  adminTotalCost: string;
  adminTotalTokens: string;
  adminFree: string;
  adminPro: string;
  adminEnterprise: string;
  adminActions: string;
  adminRole: string;
  adminUser: string;
  adminAdmin: string;
  adminDeleteMsg: string;
  adminFrom: string;
  adminMessage: string;
  adminDate: string;
  adminLogs: string;
  adminNoLogs: string;
  adminLogAction: string;
  adminLogUser: string;
  adminLogEntity: string;
  adminLogDetails: string;
  adminLogDate: string;
  adminLogIp: string;
  adminLoadMore: string;
  adminLogFilterAll: string;
  adminLogFilterAuth: string;
  adminLogFilterTicket: string;
  adminLogFilterPipeline: string;
  adminLogFilterAdmin: string;
  adminLogFilterFeedback: string;
  adminLogFilterProject: string;
  adminLogFilterDelete: string;

  // Settings categories
  settingsCatRateLimiting: string;
  settingsCatIA: string;
  settingsCatSecurity: string;
  settingsCatPipeline: string;
  settingsCatMaintenance: string;

  // IA settings
  settingsDefaultModel: string;
  settingsDefaultModelDesc: string;
  settingsReviewThreshold: string;
  settingsReviewThresholdDesc: string;
  settingsMaxTokens: string;
  settingsMaxTokensDesc: string;

  // Security settings
  settingsDevLogin: string;
  settingsDevLoginDesc: string;
  settingsRegistration: string;
  settingsRegistrationDesc: string;
  settingsSessionDuration: string;
  settingsSessionDurationDesc: string;

  // Pipeline settings
  settingsAutoTest: string;
  settingsAutoTestDesc: string;
  settingsAutoDeploy: string;
  settingsAutoDeployDesc: string;

  // Maintenance settings
  settingsMaintenanceMode: string;
  settingsMaintenanceModeDesc: string;
  settingsLogRetention: string;
  settingsLogRetentionDesc: string;

  // Plans settings
  settingsCatPlans: string;
  settingsTicketsPerMonth: string;
  settingsPipelinesPerPlan: string;
  settingsProjectsPerPlan: string;
  settingsMembersPerProject: string;
  settingsUnlimited: string;

  // Modèles & Coûts IA
  settingsCatModels: string;
  settingsClaudeVersion: string;
  settingsClaudeVersionDesc: string;
  settingsGptVersion: string;
  settingsGptVersionDesc: string;
  settingsCostClaude: string;
  settingsCostClaudeDesc: string;
  settingsCostGpt: string;
  settingsCostGptDesc: string;
  settingsTokensComplexity: string;
  settingsTokensComplexityDesc: string;
  settingsTokensChat: string;
  settingsTokensChatDesc: string;
  settingsTokensReview: string;
  settingsTokensReviewDesc: string;

  // Auth rate limits (extend security)
  settingsAuthCodeExpiry: string;
  settingsAuthCodeExpiryDesc: string;
  settingsAuthCodeLimit: string;
  settingsAuthCodeLimitDesc: string;
  settingsAuthCodeWindow: string;
  settingsAuthCodeWindowDesc: string;
  settingsAuthVerifyLimit: string;
  settingsAuthVerifyLimitDesc: string;
  settingsAuthVerifyWindow: string;
  settingsAuthVerifyWindowDesc: string;
  settingsContactLimit: string;
  settingsContactLimitDesc: string;
  settingsContactWindow: string;
  settingsContactWindowDesc: string;

  // Auto-repo
  settingsCatAutoRepo: string;
  settingsAutoRepoEnabled: string;
  settingsAutoRepoEnabledDesc: string;
  settingsAutoRepoDefaultPrivate: string;
  settingsAutoRepoDefaultPrivateDesc: string;
  autoRepoCreating: string;
  autoRepoSuccess: string;
  autoRepoFailed: string;
  autoRepoManualSetup: string;
  repoOptionAuto: string;
  repoOptionAutoDesc: string;
  repoOptionManual: string;
  repoOptionManualDesc: string;
  repoOptionNone: string;
  repoOptionNoneDesc: string;
  repoSetupLabel: string;

  // Git & Deploy
  settingsCatGit: string;
  settingsGitDefaultBranch: string;
  settingsGitDefaultBranchDesc: string;
  settingsGitTargetBranch: string;
  settingsGitTargetBranchDesc: string;
  settingsGitMergeStrategy: string;
  settingsGitMergeStrategyDesc: string;
  settingsGitCloseBranch: string;
  settingsGitCloseBranchDesc: string;
  settingsBranchMaxLength: string;
  settingsBranchMaxLengthDesc: string;

  // Queue & Pipeline (extend pipeline)
  settingsQueuePolling: string;
  settingsQueuePollingDesc: string;
  settingsTestMultiplier: string;
  settingsTestMultiplierDesc: string;

  // Interface
  settingsCatInterface: string;
  settingsAuditLogLimit: string;
  settingsAuditLogLimitDesc: string;
  settingsAuditLogMaxLimit: string;
  settingsAuditLogMaxLimitDesc: string;
  settingsNotifTimeout: string;
  settingsNotifTimeoutDesc: string;
  settingsScoreGood: string;
  settingsScoreGoodDesc: string;
  settingsScoreOk: string;
  settingsScoreOkDesc: string;
  settingsActivityPreview: string;
  settingsActivityPreviewDesc: string;

  // Toggle labels
  settingsEnabled: string;
  settingsDisabled: string;

  // Billing
  billingSubscribe: string;
  billingManage: string;
  billingCurrentPlan: string;
  billingUpgradeToPro: string;
  billingAlreadyOnPro: string;
  billingCheckoutSuccess: string;
  billingCheckoutCanceled: string;
  billingPlanLimitTickets: string;
  billingPlanLimitPipelines: string;
  billingPlanLimitProjects: string;
  billingPlanLimitMembers: string;
  billingUpgradePrompt: string;
  billingLoading: string;
  billingPortal: string;

  // Validation hints
  validationTitleHint: string;
  validationDescTicketHint: string;
  validationProjectNameHint: string;
  validationSlugHint: string;
  validationDescProjectHint: string;
  validationContactNameHint: string;
  validationContactEmailHint: string;
  validationContactMsgHint: string;
  validationCharsRemaining: string;

  // Admin Stripe
  adminStripeStatus: string;

  // Projects
  projectsTitle: string;
  projectCreate: string;
  projectName: string;
  projectSlug: string;
  projectDescription: string;
  projectPrivate: string;
  projectCollaborative: string;
  projectConnectRepo: string;
  projectConnectRepoDesc: string;
  projectNewComplete: string;
  projectNewCompleteDesc: string;
  projectDefaultRepo: string;
  projectSettings: string;
  projectGeneral: string;
  projectMembers: string;
  projectDangerZone: string;
  projectDelete: string;
  projectDeleteConfirm: string;
  projectTransferOwnership: string;
  projectTransferConfirm: string;
  projectInvite: string;
  projectInviteEmail: string;
  projectInviteRole: string;
  projectInviteSend: string;
  projectInvitations: string;
  projectNoInvitations: string;
  projectAccept: string;
  projectReject: string;
  projectRemoveMember: string;
  projectChangeRole: string;
  projectNoProjects: string;
  projectCreateFirst: string;
  projectRoleOwner: string;
  projectRoleAdmin: string;
  projectRoleMember: string;
  projectRoleViewer: string;
  projectSwitchTo: string;
  projectInvitationsBadge: string;

  // Presence & Collaboration
  usersOnline: string;
  projectCollaboration: string;
  projectCursorsEnabled: string;
  projectCursorsEnabledDesc: string;
  projectPresenceEnabled: string;
  projectPresenceEnabledDesc: string;
  projectPresenceMax: string;
  projectPresenceMaxDesc: string;

  // Collaboration features
  tabComments: string;
  commentsEmpty: string;
  commentsPlaceholder: string;
  commentsSend: string;
  commentsEdit: string;
  commentsDelete: string;
  commentsEdited: string;
  commentsMentionHint: string;
  commentsTyping: string;
  commentsEditingLock: string;
  watchTicket: string;
  unwatchTicket: string;
  watchersCount: string;
  notificationsTitle: string;
  notificationsEmpty: string;
  notificationsMarkAllRead: string;
  notificationsMention: string;
  notificationsComment: string;
  notificationsStatusChange: string;
  userStatusAvailable: string;
  userStatusBusy: string;
  userStatusAway: string;
  viewingTicket: string;
  draggingTicket: string;
  reactionsAdd: string;

  // Columns
  colTasks: string;
  colWaiting: string;
  colEstimation: string;
  colAiCoding: string;
  colAiReview: string;
  colAiTests: string;
  colDeploy: string;
  colStaging: string;
  colReview: string;
  colApproved: string;
  colRejected: string;

  // Filters
  filterStatus: string;
  filterPriority: string;
  filterAssignee: string;
  filterDueDate: string;
  filterLabel: string;
  filterClear: string;
  filterAll: string;

  // Column times
  columnTimesTitle: string;

  // Due dates
  dueDate: string;
  dueDateSet: string;
  dueDateClear: string;
  dueDateOverdue: string;
  dueDateToday: string;
  dueDateNone: string;
  dueDateThisWeek: string;

  // Labels
  labels: string;
  labelCreate: string;
  labelEdit: string;
  labelDelete: string;
  labelColor: string;
  labelName: string;
  labelNone: string;

  // Subtasks
  subtasks: string;
  subtaskAdd: string;
  subtaskPlaceholder: string;
  subtaskProgress: string;
  subtaskEmpty: string;

  // Favorites
  favorites: string;
  favoriteAdd: string;
  favoriteRemove: string;
  favoritesEmpty: string;

  // Templates
  ticketTemplates: string;
  templateCreate: string;
  templateEdit: string;
  templateDelete: string;
  templateApply: string;
  templateName: string;
  templateEmpty: string;

  // Global search
  globalSearch: string;
  searchResults: string;
  searchNoResults: string;
  searchTickets: string;
  searchComments: string;
  searchActivity: string;

  // Keyboard shortcuts
  keyboardShortcuts: string;
  shortcutNewTicket: string;
  shortcutSearch: string;
  shortcutNextTicket: string;
  shortcutPrevTicket: string;

  // Activity page
  activityPage: string;
  activityGlobal: string;
  activityEmpty: string;
  activityFilter: string;

  // Markdown
  markdownPreview: string;
  markdownEdit: string;
  markdownHelp: string;

  // History
  historyTitle: string;
  historyAll: string;
  historyCompleted: string;
  historyActive: string;
  historyArchived: string;
  listTitle: string;
  listStatus: string;
  listProgress: string;
  historyEmpty: string;

  // Export
  exportCSV: string;
  exportPDF: string;
  exportHTML: string;
  exportTitle: string;

  // Reactions
  reactions: string;
  reactionAdd: string;

  // Webhooks
  webhooks: string;
  webhookCreate: string;
  webhookEdit: string;
  webhookDelete: string;
  webhookUrl: string;
  webhookEvents: string;
  webhookSecret: string;
  webhookEnabled: string;
  webhookEmpty: string;

  // Views
  viewCalendar: string;
  viewTimeline: string;
  viewBoard: string;
  viewList: string;

  // Email notifications
  emailNotifications: string;
  emailMention: string;
  emailStatusChange: string;

  // Pipeline step
  pipelineStep: string;
  viewSite: string;

  // Project Setup
  setupTitle: string;
  setupRepoDesc: string;
  setupConnectExisting: string;
  setupConnectExistingDesc: string;
  setupCreateNew: string;
  setupCreateNewDesc: string;
  setupProvider: string;
  setupToken: string;
  setupOwner: string;
  setupRepoName: string;
  setupBranch: string;
  setupSourceBranch: string;
  setupTargetBranch: string;
  setupTestConnection: string;
  setupTestConnectionSuccess: string;
  setupTestConnectionFail: string;
  setupTesting: string;
  setupBack: string;
  setupConnect: string;
  setupCreateRepo: string;
  setupPrivate: string;
  setupPublic: string;
  setupRepoSuccess: string;
  setupDeployDesc: string;
  setupCfToken: string;
  setupCfAccountId: string;
  setupCfInfo: string;
  setupSkipDeploy: string;
  setupConfigureDeploy: string;
  setupProjectNotConfigured: string;
  compareBtn: string;
  compareBefore: string;
  compareAfter: string;
  compareTitle: string;
  compareNoProductionUrl: string;
  compareNoPreviewUrl: string;
  compareLoadingPreview: string;
  archivedOn: string;
  viewChanges: string;
}

export const translations: Record<Lang, Translations> = {
  fr: {
    credit: 'Crédit',
    tokens: 'Tokens',
    lines: 'Lignes',
    score: 'Score',
    search: 'Rechercher...',
    lightMode: 'Mode clair',
    darkMode: 'Mode sombre',
    settings: 'Paramètres',

    empty: 'Vide',
    loading: 'Chargement...',
    newTicket: 'Nouveau ticket',
    launchPipeline: 'Lancer le pipeline',
    editTicket: 'Modifier le ticket',

    createTitle: 'Nouveau ticket',
    titleLabel: 'Titre *',
    titlePlaceholder: 'Ex : Ajouter un formulaire de contact',
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'Décrivez ce que l\'IA doit faire...',
    aiModelLabel: 'Modèle IA',
    cancel: 'Annuler',
    continueBtn: 'Continuer',
    create: 'Créer',
    creating: 'Création...',

    titleFieldLabel: 'Titre :',
    titleFieldPlaceholder: 'Titre du ticket...',
    descFieldLabel: 'Description :',
    descFieldPlaceholder: 'Ajouter une description...',
    saving: 'Sauvegarde...',
    approve: 'Approuver',
    reject: 'Rejeter',
    retry: 'Réessayer',
    rollback: 'Annuler',
    delete: 'Supprimer',
    archive: 'Archiver',
    unarchive: 'Désarchiver',

    tabActivity: 'Suivi',
    tabQuality: 'Qualité',
    tabChat: 'Chat IA',
    tabLogs: 'Logs',
    tabCode: 'Code',
    tabTests: 'Tests',

    ticketCreatedBy: 'Créé par',
    ticketModifiedBy: 'Modifié par',
    ticketCreatedAt: 'Créé le',
    ticketUpdatedAt: 'Modifié le',

    noActivity: 'Aucune activité.',
    noReview: 'Pas de review IA disponible.',
    reviewScore: 'Score de review',
    issues: 'Problèmes',
    noIssues: 'Aucun problème détecté',

    chatEmpty: 'Envoyez un message pour discuter avec l\'IA sur ce ticket.',
    chatPlaceholder: 'Envoyer une correction...',

    noLogs: 'Aucun log. Lancez le pipeline pour voir les logs en temps réel.',
    loadingDiff: 'Chargement du diff...',
    noDiff: 'Aucun diff disponible. Le code n\'a pas encore été généré.',

    noTests: 'Aucun résultat de test disponible.',
    passed: 'réussis',
    failed: 'échoués',
    total: 'total',

    settingsTitle: 'Paramètres',
    maxPipelines: 'Pipelines simultanés',
    maxPipelinesDesc: 'Nombre maximum de pipelines IA en parallèle',
    maxRequests: 'Requêtes / minute',
    maxRequestsDesc: 'Limite de requêtes API par minute',
    maxTickets: 'Tickets / heure',
    maxTicketsDesc: 'Limite de création de tickets par heure',
    language: 'Langue',
    languageDesc: 'Langue de l\'interface',
    save: 'Enregistrer',
    savedOk: 'Paramètres sauvegardés',
    close: 'Fermer',

    animations: 'Animations',
    animationsDesc: 'Effets visuels, pulsations et mouvements',
    animationsOn: 'Activées',
    animationsOff: 'Désactivées',

    aiDesign: 'Design AI',
    aiDesignDesc: 'Grain, glassmorphism, orbe, néon, grille, barre live',
    aiDesignOn: 'Activé',
    aiDesignOff: 'Désactivé',

    mascot: 'Mascotte 🦀',
    mascotDesc: 'Petit crabe animé en bas à droite',
    mascotOn: 'Visible',
    mascotOff: 'Masqué',

    cmdPlaceholder: 'Rechercher un ticket, une commande...',
    cmdNoResults: 'Aucun résultat',
    cmdHint: 'Ctrl+K pour rechercher',

    confirmDeleteTitle: 'Supprimer ce ticket ?',
    confirmDeleteMsg: 'Cette action est irréversible. Le ticket et toutes ses données seront supprimés.',
    confirmYes: 'Supprimer',
    confirmNo: 'Annuler',

    onboardWelcome: 'Bienvenue sur CrabCreate ! 🦀',
    onboardStep1: 'Créez un ticket en cliquant sur le bouton + dans la colonne Tâches.',
    onboardStep2: 'Lancez le pipeline IA avec le bouton ▶ sur un ticket.',
    onboardStep3: 'Suivez la progression en temps réel dans chaque colonne.',
    onboardStep4: 'Ouvrez un ticket pour voir les logs, le code, les tests et discuter avec l\'IA.',
    onboardGo: 'C\'est parti !',
    onboardSkip: 'Passer',
    onboardNext: 'Suivant',
    onboardQuickTour: 'Tutoriel rapide ~30 sec',
    onboardDemoTitle: 'Cr\u00e9er un blog',
    onboardDemoDesc: 'Cr\u00e9er un site avec une page d\u0027accueil et un onglet blog',
    onboardPipelineRunning: 'Pipeline en cours...',
    onboardPipelineQueued: 'Mise en file d\'attente...',
    onboardPipelineEstimating: 'Estimation : {cost}$',
    onboardPipelineCoding: 'Codage en cours... +{lines} lignes',
    onboardPipelineReview: 'Code review : {score}/100 \u2713',
    onboardPipelineTesting: 'Tests automatiques... 12/12 \u2713',
    onboardPipelineDeploying: 'D\u00e9ploiement sur le serveur...',
    onboardPipelineStaging: 'V\u00e9rification en cours...',
    onboardPipelineWaitApprove: 'En attente d\'approbation',
    onboardPipelineApproved: 'D\u00e9ploy\u00e9 avec succ\u00e8s !',
    onboardApproveQuestion: 'Approuvez-vous ce d\u00e9ploiement ?',
    onboardApproveYes: 'Oui, approuver',
    onboardApproveNo: 'Non, rejeter',
    onboardCelebrationTitle: 'D\u00e9ploy\u00e9 avec succ\u00e8s !',
    onboardCelebrationLink: 'main-site.com/blog',
    onboardCompleteTitle: 'Tutoriel termin\u00e9 !',
    onboardCompleteDesc: 'Vous pouvez maintenant cr\u00e9er votre premier billet.',
    onboardCompleteBtn: 'C\'est parti !',
    onboardFeedbackQuestion: 'Ce tutoriel vous a été utile ?',

    authSubtitle: 'Connectez-vous pour accéder au dashboard',
    authEnterEmail: 'Adresse email',
    authSendCode: 'Envoyer le code',
    authBackToEmail: 'Retour',
    authCodeSentTo: 'Code envoyé à',
    authCodeExpiry: 'Le code expire dans 10 minutes',
    authVerify: 'Vérification',
    authVerified: 'Connexion réussie !',
    authLogout: 'Déconnexion',
    authLoading: 'Connexion en cours...',
    authLoggedAs: 'Connecté',

    liveIdle: 'Tous les pipelines sont inactifs',
    liveWorking: 'traite le ticket',

    pipelineLaunched: 'Pipeline lancé pour',
    error: 'Erreur',

    navHome: 'Accueil',
    navPricing: 'Tarifs',
    navContact: 'Contact',
    navLogin: 'Connexion',

    landingHero: 'Automatisez vos modifications de code avec l\'IA',
    landingHeroSub: 'CrabCreate code, review et déploie vos changements automatiquement. De la description au déploiement en quelques minutes, quel que soit le langage.',
    landingCTA: 'Commencer gratuitement',
    landingFeature1Title: 'AI Coding',
    landingFeature1Desc: 'Claude ou GPT-5 génère le code à partir de votre description en langage naturel, dans n\'importe quel langage.',
    landingFeature2Title: 'AI Review',
    landingFeature2Desc: 'Chaque modification est automatiquement reviewée par une seconde IA avec un score sur 100.',
    landingFeature3Title: 'Auto-Tests',
    landingFeature3Desc: 'Des tests unitaires sont générés et exécutés automatiquement pour valider les changements.',
    landingFeature4Title: 'Auto-Deploy',
    landingFeature4Desc: 'Push automatique sur votre dépôt Git, création de PR et déploiement staging.',
    landingHowTitle: 'Comment ça marche',
    landingStep1: 'Décrivez',
    landingStep1Desc: 'Créez un ticket décrivant la modification souhaitée sur votre projet.',
    landingStep2: 'L\'IA code',
    landingStep2Desc: 'L\'intelligence artificielle génère le code en analysant votre base existante.',
    landingStep3: 'Review & Tests',
    landingStep3Desc: 'Une seconde IA review le code. Des tests sont générés et exécutés automatiquement.',
    landingStep4: 'Déployez',
    landingStep4Desc: 'Validez les changements et déployez en un clic vers votre environnement de staging.',

    // Comparison table
    comparisonTitle: 'Pourquoi choisir CrabCreate ?',
    comparisonSubtitle: 'Comparez les fonctionnalités avec les outils de gestion de projet les plus populaires.',
    compFeature: 'Fonctionnalité',
    compAICoding: 'Codage par IA',
    compAutoReview: 'Review automatique',
    compAutoTest: 'Tests automatiques',
    compAutoDeploy: 'Déploiement auto',
    compKanban: 'Board Kanban',
    compRealtime: 'Temps réel',
    compSubtasks: 'Sous-tâches',
    compLabels: 'Labels / Tags',
    compDueDates: 'Dates d\'échéance',
    compCalendar: 'Vue calendrier',
    compTimeline: 'Vue timeline',
    compTemplates: 'Templates de tickets',
    compSearch: 'Recherche globale',
    compExport: 'Export CSV / PDF',
    compWebhooks: 'Webhooks',
    compKeyboardShortcuts: 'Raccourcis clavier',
    compMarkdown: 'Markdown',
    compSelfHosted: 'Auto-hébergé',
    compFreeTier: 'Plan gratuit',
    compPartial: 'Partiel',
    compPaid: 'Payant',

    pricingTitle: 'Tarifs simples et transparents',
    pricingSub: 'Choisissez le plan qui correspond à vos besoins.',
    pricingFree: 'Gratuit',
    pricingFreePrice: '0$',
    pricingPro: 'Pro',
    pricingProPrice: '49$',
    pricingEnterprise: 'Entreprise',
    pricingEnterprisePrice: 'Sur devis',
    pricingChoose: 'Choisir',
    pricingContact: 'Nous contacter',
    pricingFeatureTickets: 'tickets / mois',
    pricingFeaturePipelines: 'pipeline(s) simultané(s)',
    pricingFeatureSupport: 'Support communautaire',
    pricingFeaturePriority: 'File d\'attente prioritaire',
    pricingFeatureDedicated: 'Support dédié',
    pricingPerMonth: '/ mois',

    contactTitle: 'Contactez-nous',
    contactSub: 'Une question, une suggestion ? Envoyez-nous un message.',
    contactName: 'Nom',
    contactEmail: 'Email',
    contactMessage: 'Message',
    contactSend: 'Envoyer',
    contactSending: 'Envoi en cours...',
    contactSuccess: 'Message envoyé avec succès ! Nous vous répondrons rapidement.',

    legalTitle: 'Mentions légales & CGU',
    privacyTitle: 'Politique de confidentialité',

    notFoundTitle: 'Page introuvable',
    notFoundDesc: 'La page que vous cherchez n\'existe pas ou a été déplacée.',
    notFoundBack: 'Retour à l\'accueil',

    footerRights: '© 2026 CrabCreate. Tous droits réservés.',
    footerLegal: 'Mentions légales',
    footerPrivacy: 'Confidentialité',

    userMenuTheme: 'Thème',
    userMenuLang: 'Langue',
    userMenuAnimations: 'Animations',
    userMenuAIDesign: 'AI Design',
    userMenuMascot: 'Mascotte',
    userMenuSettings: 'Paramètres',

    adminTitle: 'Administration',
    adminUsers: 'Utilisateurs',
    adminContacts: 'Messages',
    adminSettings: 'Paramètres',
    adminStats: 'Statistiques',
    adminEmail: 'Email',
    adminPlan: 'Plan',
    adminBlocked: 'Bloqué',
    adminLastLogin: 'Dernière connexion',
    adminCreatedAt: 'Inscription',
    adminBlock: 'Bloquer',
    adminUnblock: 'Débloquer',
    adminBlockReason: 'Raison du blocage',
    adminNoUsers: 'Aucun utilisateur.',
    adminNoContacts: 'Aucun message de contact.',
    adminTotalUsers: 'Utilisateurs',
    adminActiveUsers: 'Actifs',
    adminBlockedUsers: 'Bloqués',
    adminTotalTickets: 'Tickets total',
    adminTotalCost: 'Coût total',
    adminTotalTokens: 'Tokens total',
    adminFree: 'Gratuit',
    adminPro: 'Pro',
    adminEnterprise: 'Entreprise',
    adminActions: 'Actions',
    adminRole: 'Rôle',
    adminUser: 'Utilisateur',
    adminAdmin: 'Admin',
    adminDeleteMsg: 'Supprimer',
    adminFrom: 'De',
    adminMessage: 'Message',
    adminDate: 'Date',
    adminLogs: 'Logs',
    adminNoLogs: 'Aucun log',
    adminLogAction: 'Action',
    adminLogUser: 'Utilisateur',
    adminLogEntity: 'Entité',
    adminLogDetails: 'Détails',
    adminLogDate: 'Date',
    adminLogIp: 'IP',
    adminLoadMore: 'Charger plus',
    adminLogFilterAll: 'Tous',
    adminLogFilterAuth: 'Auth',
    adminLogFilterTicket: 'Tickets',
    adminLogFilterPipeline: 'Pipeline',
    adminLogFilterAdmin: 'Admin',
    adminLogFilterFeedback: 'Avis Guide',
    adminLogFilterProject: 'Projets',
    adminLogFilterDelete: 'Suppressions',

    settingsCatRateLimiting: 'Limites de débit',
    settingsCatIA: 'Intelligence Artificielle',
    settingsCatSecurity: 'Sécurité',
    settingsCatPipeline: 'Pipeline',
    settingsCatMaintenance: 'Maintenance',

    settingsDefaultModel: 'Modèle IA par défaut',
    settingsDefaultModelDesc: 'Modèle utilisé par défaut pour les nouveaux tickets',
    settingsReviewThreshold: 'Seuil de review IA',
    settingsReviewThresholdDesc: 'Score minimum pour passer la review (auto-reject si en dessous)',
    settingsMaxTokens: 'Max tokens (génération)',
    settingsMaxTokensDesc: 'Nombre maximum de tokens pour la génération de code',

    settingsDevLogin: 'Dev login',
    settingsDevLoginDesc: 'Activer le login rapide en développement',
    settingsRegistration: 'Inscriptions',
    settingsRegistrationDesc: 'Autoriser les nouvelles inscriptions',
    settingsSessionDuration: 'Durée de session (jours)',
    settingsSessionDurationDesc: 'Durée de validité de la session JWT',

    settingsAutoTest: 'Tests automatiques',
    settingsAutoTestDesc: 'Exécuter les tests automatiquement dans le pipeline',
    settingsAutoDeploy: 'Déploiement auto',
    settingsAutoDeployDesc: 'Déployer automatiquement en staging après les tests',

    settingsMaintenanceMode: 'Mode maintenance',
    settingsMaintenanceModeDesc: 'Bloque l\'accès sauf pour les administrateurs',
    settingsLogRetention: 'Rétention des logs (jours)',
    settingsLogRetentionDesc: 'Durée de conservation des audit logs',

    settingsCatPlans: 'Plans',
    settingsTicketsPerMonth: 'Tickets / mois',
    settingsPipelinesPerPlan: 'Pipelines simultanés',
    settingsProjectsPerPlan: 'Projets max',
    settingsMembersPerProject: 'Membres / projet',
    settingsUnlimited: 'Illimité',

    settingsCatModels: 'Modèles & Coûts IA',
    settingsClaudeVersion: 'Version Claude',
    settingsClaudeVersionDesc: 'Identifiant du modèle Anthropic (ex: claude-opus-4-6)',
    settingsGptVersion: 'Version GPT',
    settingsGptVersionDesc: 'Identifiant du modèle OpenAI (ex: gpt-5.3)',
    settingsCostClaude: 'Coût/token Claude',
    settingsCostClaudeDesc: 'Prix par token pour le suivi des coûts ($)',
    settingsCostGpt: 'Coût/token GPT',
    settingsCostGptDesc: 'Prix par token pour le suivi des coûts ($)',
    settingsTokensComplexity: 'Tokens (estimation)',
    settingsTokensComplexityDesc: 'Max tokens pour l\'estimation de complexité',
    settingsTokensChat: 'Tokens (chat)',
    settingsTokensChatDesc: 'Max tokens pour les réponses du chat IA',
    settingsTokensReview: 'Tokens (review)',
    settingsTokensReviewDesc: 'Max tokens pour la review de code IA',

    settingsAuthCodeExpiry: 'Expiration du code (min)',
    settingsAuthCodeExpiryDesc: 'Durée de validité du code de connexion',
    settingsAuthCodeLimit: 'Limite demandes code',
    settingsAuthCodeLimitDesc: 'Nombre max de demandes de code par fenêtre',
    settingsAuthCodeWindow: 'Fenêtre demandes (min)',
    settingsAuthCodeWindowDesc: 'Durée de la fenêtre de rate limit pour les codes',
    settingsAuthVerifyLimit: 'Limite vérifications',
    settingsAuthVerifyLimitDesc: 'Nombre max de tentatives de vérification par fenêtre',
    settingsAuthVerifyWindow: 'Fenêtre vérif. (min)',
    settingsAuthVerifyWindowDesc: 'Durée de la fenêtre de rate limit pour les vérifications',
    settingsContactLimit: 'Limite messages contact',
    settingsContactLimitDesc: 'Nombre max de messages contact par fenêtre',
    settingsContactWindow: 'Fenêtre contact (min)',
    settingsContactWindowDesc: 'Durée de la fenêtre de rate limit pour le formulaire',

    settingsCatGit: 'Git & Déploiement',
    settingsGitDefaultBranch: 'Branche source',
    settingsGitDefaultBranchDesc: 'Branche source pour le clone/pull (master, main...)',
    settingsGitTargetBranch: 'Branche cible PR',
    settingsGitTargetBranchDesc: 'Branche cible pour les Pull Requests (develop, main...)',
    settingsGitMergeStrategy: 'Stratégie de merge',
    settingsGitMergeStrategyDesc: 'Méthode de fusion des Pull Requests',
    settingsGitCloseBranch: 'Fermer branche source',
    settingsGitCloseBranchDesc: 'Supprimer la branche source après merge de la PR',
    settingsBranchMaxLength: 'Max longueur branche',
    settingsBranchMaxLengthDesc: 'Longueur max du nom de branche généré',

    settingsCatAutoRepo: 'Repo Git auto',
    settingsAutoRepoEnabled: 'Auto-repo activé',
    settingsAutoRepoEnabledDesc: 'Créer un repo GitHub automatiquement à la création de projet',
    settingsAutoRepoDefaultPrivate: 'Repos privés',
    settingsAutoRepoDefaultPrivateDesc: 'Les repos auto sont créés en privé par défaut',
    autoRepoCreating: 'Création du repo GitHub...',
    autoRepoSuccess: 'Repo GitHub créé !',
    autoRepoFailed: 'Échec création auto du repo',
    autoRepoManualSetup: 'Configurable manuellement dans les paramètres du projet',
    repoOptionAuto: 'Créer un repo GitHub',
    repoOptionAutoDesc: 'Un repo sera créé automatiquement',
    repoOptionManual: 'Configurer plus tard',
    repoOptionManualDesc: 'Connecter un repo existant après la création',
    repoOptionNone: 'Sans repo',
    repoOptionNoneDesc: 'Configurer le repo manuellement plus tard',
    repoSetupLabel: 'Dépôt Git',

    settingsQueuePolling: 'Polling queue (ms)',
    settingsQueuePollingDesc: 'Intervalle de vérification de la queue de dépendances',
    settingsTestMultiplier: 'Tests par fichier',
    settingsTestMultiplierDesc: 'Multiplicateur de tests générés par fichier modifié',

    settingsCatInterface: 'Interface',
    settingsAuditLogLimit: 'Logs par page',
    settingsAuditLogLimitDesc: 'Nombre de logs affichés par défaut',
    settingsAuditLogMaxLimit: 'Max logs par requête',
    settingsAuditLogMaxLimitDesc: 'Limite max de logs chargeable en une requête',
    settingsNotifTimeout: 'Durée notifications (ms)',
    settingsNotifTimeoutDesc: 'Durée d\'affichage des notifications toast',
    settingsScoreGood: 'Seuil score vert',
    settingsScoreGoodDesc: 'Score minimum pour afficher en vert (bon)',
    settingsScoreOk: 'Seuil score orange',
    settingsScoreOkDesc: 'Score minimum pour afficher en orange (acceptable)',
    settingsActivityPreview: 'Aperçu activité (car.)',
    settingsActivityPreviewDesc: 'Longueur de l\'aperçu des messages dans les logs',

    settingsEnabled: 'Activé',
    settingsDisabled: 'Désactivé',

    billingSubscribe: 'S\'abonner',
    billingManage: 'Modifier l\'abonnement actuel',
    billingCurrentPlan: 'Plan actuel',
    billingUpgradeToPro: 'Passer au Pro',
    billingAlreadyOnPro: 'Vous etes deja abonne au plan Pro.',
    billingCheckoutSuccess: 'Abonnement Pro activé avec succès !',
    billingCheckoutCanceled: 'Paiement annulé.',
    billingPlanLimitTickets: 'Limite de tickets atteinte pour votre plan.',
    billingPlanLimitPipelines: 'Limite de pipelines atteinte pour votre plan.',
    billingPlanLimitProjects: 'Limite de projets atteinte pour votre plan.',
    billingPlanLimitMembers: 'Limite de membres atteinte pour ce projet.',
    billingUpgradePrompt: 'Passez au plan Pro pour augmenter vos limites.',
    billingLoading: 'Redirection vers le paiement...',
    billingPortal: 'Portail de facturation',

    validationTitleHint: '3 à 200 caractères',
    validationDescTicketHint: 'Max 5000 caractères',
    validationProjectNameHint: '2 à 100 caractères',
    validationSlugHint: 'Minuscules, chiffres et tirets uniquement (ex: mon-projet)',
    validationDescProjectHint: 'Max 500 caractères',
    validationContactNameHint: 'Requis',
    validationContactEmailHint: 'Adresse email valide',
    validationContactMsgHint: 'Max 5000 caractères',
    validationCharsRemaining: 'caractères restants',

    adminStripeStatus: 'Stripe',

    projectsTitle: 'Projets',
    projectCreate: 'Nouveau projet',
    projectName: 'Nom du projet',
    projectSlug: 'Slug (URL)',
    projectDescription: 'Description',
    projectPrivate: 'Privé',
    projectCollaborative: 'Collaboratif',
    projectConnectRepo: 'Se connecter à un repo existant',
    projectConnectRepoDesc: 'GitHub / GitLab / Bitbucket · Base de données non incluse · Déploiement serveur non inclus',
    projectNewComplete: 'Nouveau projet complet',
    projectNewCompleteDesc: 'Aucun code de départ · Base de données créée · Déploiement serveur compris',
    projectDefaultRepo: 'Dépôt par défaut',
    projectSettings: 'Paramètres du projet',
    projectGeneral: 'Général',
    projectMembers: 'Membres',
    projectDangerZone: 'Zone danger',
    projectDelete: 'Supprimer le projet',
    projectDeleteConfirm: 'Supprimer ce projet et tous ses tickets ? Cette action est irréversible.',
    projectTransferOwnership: 'Transférer la propriété',
    projectTransferConfirm: 'Êtes-vous sûr de vouloir transférer la propriété ?',
    projectInvite: 'Inviter un membre',
    projectInviteEmail: 'Email du membre',
    projectInviteRole: 'Rôle',
    projectInviteSend: 'Envoyer l\'invitation',
    projectInvitations: 'Invitations',
    projectNoInvitations: 'Aucune invitation en attente.',
    projectAccept: 'Accepter',
    projectReject: 'Refuser',
    projectRemoveMember: 'Retirer',
    projectChangeRole: 'Changer le rôle',
    projectNoProjects: 'Aucun projet',
    projectCreateFirst: 'Créez votre premier projet pour commencer.',
    projectRoleOwner: 'Propriétaire',
    projectRoleAdmin: 'Admin',
    projectRoleMember: 'Membre',
    projectRoleViewer: 'Lecteur',
    projectSwitchTo: 'Changer de projet',
    projectInvitationsBadge: 'Invitations',

    usersOnline: '{count} utilisateur(s) en ligne',
    projectCollaboration: 'Collaboration',
    projectCursorsEnabled: 'Curseurs en direct',
    projectCursorsEnabledDesc: 'Voir les curseurs des autres membres en temps réel',
    projectPresenceEnabled: 'Présence en ligne',
    projectPresenceEnabledDesc: 'Afficher les avatars des membres connectés dans le header',
    projectPresenceMax: 'Avatars max visibles',
    projectPresenceMaxDesc: 'Nombre maximum d\'avatars affichés avant le compteur +N',

    tabComments: 'Commentaires',
    commentsEmpty: 'Aucun commentaire. Soyez le premier a commenter.',
    commentsPlaceholder: 'Ecrire un commentaire... (@email pour mentionner)',
    commentsSend: 'Envoyer',
    commentsEdit: 'Modifier',
    commentsDelete: 'Supprimer',
    commentsEdited: '(modifie)',
    commentsMentionHint: 'Utilisez @email pour mentionner un membre',
    commentsTyping: 'est en train d\'ecrire...',
    commentsEditingLock: 'est en train de modifier ce ticket',
    watchTicket: 'Suivre',
    unwatchTicket: 'Ne plus suivre',
    watchersCount: '{count} observateur(s)',
    notificationsTitle: 'Notifications',
    notificationsEmpty: 'Aucune notification.',
    notificationsMarkAllRead: 'Tout marquer comme lu',
    notificationsMention: 'Mention',
    notificationsComment: 'Commentaire',
    notificationsStatusChange: 'Changement de statut',
    userStatusAvailable: 'Disponible',
    userStatusBusy: 'Occupe',
    userStatusAway: 'Absent',
    viewingTicket: 'consulte ce ticket',
    draggingTicket: 'deplace ce ticket',
    reactionsAdd: 'Reagir',

    colTasks: 'Tâches',
    colWaiting: 'En Attente',
    colEstimation: 'Estimation',
    colAiCoding: 'AI Coding',
    colAiReview: 'AI Review',
    colAiTests: 'AI Tests',
    colDeploy: 'Déploiement',
    colStaging: 'Staging',
    colReview: 'Review',
    colApproved: 'Approuvé',
    colRejected: 'Rejeté',

    filterStatus: 'Statut',
    filterPriority: 'Priorité',
    filterAssignee: 'Assigné',
    filterDueDate: 'Échéance',
    filterLabel: 'Label',
    filterClear: 'Effacer les filtres',
    filterAll: 'Tous',

    columnTimesTitle: 'Temps par colonne',

    dueDate: 'Échéance',
    dueDateSet: 'Définir une échéance',
    dueDateClear: 'Retirer l\'échéance',
    dueDateOverdue: 'En retard',
    dueDateToday: 'Aujourd\'hui',
    dueDateNone: 'Sans échéance',
    dueDateThisWeek: 'Cette semaine',

    labels: 'Labels',
    labelCreate: 'Créer un label',
    labelEdit: 'Modifier le label',
    labelDelete: 'Supprimer le label',
    labelColor: 'Couleur',
    labelName: 'Nom du label',
    labelNone: 'Aucun label',

    subtasks: 'Sous-tâches',
    subtaskAdd: 'Ajouter une sous-tâche',
    subtaskPlaceholder: 'Nouvelle sous-tâche...',
    subtaskProgress: '{done}/{total} terminées',
    subtaskEmpty: 'Aucune sous-tâche.',

    favorites: 'Favoris',
    favoriteAdd: 'Ajouter aux favoris',
    favoriteRemove: 'Retirer des favoris',
    favoritesEmpty: 'Aucun favori.',

    ticketTemplates: 'Modèles de ticket',
    templateCreate: 'Créer un modèle',
    templateEdit: 'Modifier le modèle',
    templateDelete: 'Supprimer le modèle',
    templateApply: 'Appliquer un modèle',
    templateName: 'Nom du modèle',
    templateEmpty: 'Aucun modèle.',

    globalSearch: 'Recherche globale',
    searchResults: 'Résultats',
    searchNoResults: 'Aucun résultat trouvé.',
    searchTickets: 'Tickets',
    searchComments: 'Commentaires',
    searchActivity: 'Activité',

    keyboardShortcuts: 'Raccourcis clavier',
    shortcutNewTicket: 'Nouveau ticket',
    shortcutSearch: 'Rechercher',
    shortcutNextTicket: 'Ticket suivant',
    shortcutPrevTicket: 'Ticket précédent',

    activityPage: 'Activité du projet',
    activityGlobal: 'Activité globale',
    activityEmpty: 'Aucune activité récente.',
    activityFilter: 'Filtrer par type',

    markdownPreview: 'Aperçu',
    markdownEdit: 'Éditer',
    markdownHelp: 'Markdown supporté',

    historyTitle: 'Historique',
    historyAll: 'Tous',
    historyCompleted: 'Terminés',
    historyActive: 'En cours',
    historyArchived: 'Archivés',
    listTitle: 'Titre',
    listStatus: 'Statut',
    listProgress: 'Progression',
    historyEmpty: 'Aucun billet trouvé',

    exportCSV: 'Exporter CSV',
    exportPDF: 'Exporter PDF',
    exportHTML: 'Exporter HTML',
    exportTitle: 'Exporter',

    reactions: 'Réactions',
    reactionAdd: 'Ajouter une réaction',

    webhooks: 'Webhooks',
    webhookCreate: 'Créer un webhook',
    webhookEdit: 'Modifier le webhook',
    webhookDelete: 'Supprimer le webhook',
    webhookUrl: 'URL',
    webhookEvents: 'Événements',
    webhookSecret: 'Secret',
    webhookEnabled: 'Activé',
    webhookEmpty: 'Aucun webhook configuré.',

    viewCalendar: 'Calendrier',
    viewTimeline: 'Timeline',
    viewBoard: 'Tableau',
    viewList: 'Liste',

    emailNotifications: 'Notifications email',
    emailMention: 'Notifier par email en cas de mention',
    emailStatusChange: 'Notifier par email en cas de changement de statut',

    pipelineStep: 'Étape',
    viewSite: 'Voir le site',

    setupTitle: 'Configurer le projet',
    setupRepoDesc: 'Connectez un dépôt Git pour activer la pipeline IA.',
    setupConnectExisting: 'Connecter un repo',
    setupConnectExistingDesc: 'Repo GitHub, GitLab ou Bitbucket existant',
    setupCreateNew: 'Créer un repo',
    setupCreateNewDesc: 'Créer un nouveau dépôt automatiquement',
    setupProvider: 'Provider Git',
    setupToken: 'Personal Access Token',
    setupOwner: 'Owner / Organisation',
    setupRepoName: 'Nom du repo',
    setupBranch: 'Branche par défaut',
    setupSourceBranch: 'Branche source (pull)',
    setupTargetBranch: 'Branche cible (PR)',
    setupTestConnection: 'Tester la connexion',
    setupTestConnectionSuccess: 'Connexion réussie !',
    setupTestConnectionFail: 'Connexion échouée',
    setupTesting: 'Test en cours...',
    setupBack: 'Retour',
    setupConnect: 'Connecter',
    setupCreateRepo: 'Créer le repo',
    setupPrivate: 'Privé',
    setupPublic: 'Public',
    setupRepoSuccess: 'Repo Git connecté avec succès !',
    setupDeployDesc: 'Configurez le déploiement automatique (optionnel).',
    setupCfToken: 'Cloudflare API Token',
    setupCfAccountId: 'Cloudflare Account ID',
    setupCfInfo: 'Un projet Cloudflare Pages sera créé automatiquement. DB Supabase multi-tenant incluse.',
    setupSkipDeploy: 'Passer cette étape',
    setupConfigureDeploy: 'Configurer',
    setupProjectNotConfigured: 'Projet non configuré',
    compareBtn: 'Comparer',
    compareBefore: 'Avant (Production)',
    compareAfter: 'Après (Preview)',
    compareTitle: 'Comparaison avant / après',
    compareNoProductionUrl: 'URL de production non configurée',
    compareNoPreviewUrl: 'URL de preview non disponible',
    compareLoadingPreview: 'Chargement du preview...',
    archivedOn: 'Archivé le',
    viewChanges: 'Voir changements',
  },
  en: {
    credit: 'Credit',
    tokens: 'Tokens',
    lines: 'Lines',
    score: 'Score',
    search: 'Search...',
    lightMode: 'Light mode',
    darkMode: 'Dark mode',
    settings: 'Settings',

    empty: 'Empty',
    loading: 'Loading...',
    newTicket: 'New ticket',
    launchPipeline: 'Launch pipeline',
    editTicket: 'Edit ticket',

    createTitle: 'New ticket',
    titleLabel: 'Title *',
    titlePlaceholder: 'E.g.: Add a contact form',
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'Describe what the AI should do...',
    aiModelLabel: 'AI Model',
    cancel: 'Cancel',
    continueBtn: 'Continue',
    create: 'Create',
    creating: 'Creating...',

    titleFieldLabel: 'Title:',
    titleFieldPlaceholder: 'Ticket title...',
    descFieldLabel: 'Description:',
    descFieldPlaceholder: 'Add a description...',
    saving: 'Saving...',
    approve: 'Approve',
    reject: 'Reject',
    retry: 'Retry',
    rollback: 'Rollback',
    delete: 'Delete',
    archive: 'Archive',
    unarchive: 'Unarchive',

    tabActivity: 'Activity',
    tabQuality: 'Quality',
    tabChat: 'AI Chat',
    tabLogs: 'Logs',
    tabCode: 'Code',
    tabTests: 'Tests',

    ticketCreatedBy: 'Created by',
    ticketModifiedBy: 'Modified by',
    ticketCreatedAt: 'Created',
    ticketUpdatedAt: 'Modified',

    noActivity: 'No activity yet.',
    noReview: 'No AI review available.',
    reviewScore: 'Review score',
    issues: 'Issues',
    noIssues: 'No issues detected',

    chatEmpty: 'Send a message to chat with the AI about this ticket.',
    chatPlaceholder: 'Send a message...',

    noLogs: 'No logs. Launch the pipeline to see real-time logs.',
    loadingDiff: 'Loading diff...',
    noDiff: 'No diff available. Code has not been generated yet.',

    noTests: 'No test results available.',
    passed: 'passed',
    failed: 'failed',
    total: 'total',

    settingsTitle: 'Settings',
    maxPipelines: 'Concurrent pipelines',
    maxPipelinesDesc: 'Maximum number of AI pipelines running in parallel',
    maxRequests: 'Requests / minute',
    maxRequestsDesc: 'API request limit per minute',
    maxTickets: 'Tickets / hour',
    maxTicketsDesc: 'Ticket creation limit per hour',
    language: 'Language',
    languageDesc: 'Interface language',
    save: 'Save',
    savedOk: 'Settings saved',
    close: 'Close',

    animations: 'Animations',
    animationsDesc: 'Visual effects, pulses and motion',
    animationsOn: 'Enabled',
    animationsOff: 'Disabled',

    aiDesign: 'AI Design',
    aiDesignDesc: 'Grain, glassmorphism, orb, neon, grid, live bar',
    aiDesignOn: 'Enabled',
    aiDesignOff: 'Disabled',

    mascot: 'Mascot 🦀',
    mascotDesc: 'Animated crab in the bottom-right corner',
    mascotOn: 'Visible',
    mascotOff: 'Hidden',

    cmdPlaceholder: 'Search a ticket, a command...',
    cmdNoResults: 'No results',
    cmdHint: 'Ctrl+K to search',

    confirmDeleteTitle: 'Delete this ticket?',
    confirmDeleteMsg: 'This action is irreversible. The ticket and all its data will be deleted.',
    confirmYes: 'Delete',
    confirmNo: 'Cancel',

    onboardWelcome: 'Welcome to CrabCreate! 🦀',
    onboardStep1: 'Create a ticket by clicking the + button in the Tasks column.',
    onboardStep2: 'Launch the AI pipeline with the ▶ button on a ticket.',
    onboardStep3: 'Track progress in real time across each column.',
    onboardStep4: 'Open a ticket to see logs, code, tests and chat with the AI.',
    onboardGo: 'Let\'s go!',
    onboardSkip: 'Skip',
    onboardNext: 'Next',
    onboardQuickTour: 'Quick tour ~30 sec',
    onboardDemoTitle: 'Create a blog',
    onboardDemoDesc: 'Create a website with a homepage and a blog tab',
    onboardPipelineRunning: 'Pipeline running...',
    onboardPipelineQueued: 'Queuing...',
    onboardPipelineEstimating: 'Estimating: {cost}$',
    onboardPipelineCoding: 'Coding... +{lines} lines',
    onboardPipelineReview: 'Code review: {score}/100 \u2713',
    onboardPipelineTesting: 'Running tests... 12/12 \u2713',
    onboardPipelineDeploying: 'Deploying to server...',
    onboardPipelineStaging: 'Verifying...',
    onboardPipelineWaitApprove: 'Waiting for approval',
    onboardPipelineApproved: 'Deployed successfully!',
    onboardApproveQuestion: 'Do you approve this deployment?',
    onboardApproveYes: 'Yes, approve',
    onboardApproveNo: 'No, reject',
    onboardCelebrationTitle: 'Deployed successfully!',
    onboardCelebrationLink: 'main-site.com/blog',
    onboardCompleteTitle: 'Tutorial complete!',
    onboardCompleteDesc: 'You can now create your first ticket.',
    onboardCompleteBtn: 'Let\'s go!',
    onboardFeedbackQuestion: 'Was this tutorial helpful?',

    authSubtitle: 'Sign in to access the dashboard',
    authEnterEmail: 'Email address',
    authSendCode: 'Send code',
    authBackToEmail: 'Back',
    authCodeSentTo: 'Code sent to',
    authCodeExpiry: 'Code expires in 10 minutes',
    authVerify: 'Verifying',
    authVerified: 'Successfully signed in!',
    authLogout: 'Log out',
    authLoading: 'Signing in...',
    authLoggedAs: 'Signed in',

    liveIdle: 'All pipelines idle',
    liveWorking: 'is processing ticket',

    pipelineLaunched: 'Pipeline launched for',
    error: 'Error',

    navHome: 'Home',
    navPricing: 'Pricing',
    navContact: 'Contact',
    navLogin: 'Sign in',

    landingHero: 'Automate your code modifications with AI',
    landingHeroSub: 'CrabCreate codes, reviews and deploys your changes automatically. From description to deployment in minutes, in any language.',
    landingCTA: 'Get started for free',
    landingFeature1Title: 'AI Coding',
    landingFeature1Desc: 'Claude or GPT-5 generates code from your natural language description, in any programming language.',
    landingFeature2Title: 'AI Review',
    landingFeature2Desc: 'Every change is automatically reviewed by a second AI with a score out of 100.',
    landingFeature3Title: 'Auto-Tests',
    landingFeature3Desc: 'Unit tests are generated and run automatically to validate changes.',
    landingFeature4Title: 'Auto-Deploy',
    landingFeature4Desc: 'Automatic push to your Git repository, PR creation and staging deployment.',
    landingHowTitle: 'How it works',
    landingStep1: 'Describe',
    landingStep1Desc: 'Create a ticket describing the desired modification on your project.',
    landingStep2: 'AI codes',
    landingStep2Desc: 'The AI generates code by analyzing your existing codebase.',
    landingStep3: 'Review & Tests',
    landingStep3Desc: 'A second AI reviews the code. Tests are generated and run automatically.',
    landingStep4: 'Deploy',
    landingStep4Desc: 'Validate the changes and deploy in one click to your staging environment.',

    // Comparison table
    comparisonTitle: 'Why choose CrabCreate?',
    comparisonSubtitle: 'Compare features with the most popular project management tools.',
    compFeature: 'Feature',
    compAICoding: 'AI Coding',
    compAutoReview: 'Auto Review',
    compAutoTest: 'Auto Testing',
    compAutoDeploy: 'Auto Deploy',
    compKanban: 'Kanban Board',
    compRealtime: 'Real-time',
    compSubtasks: 'Subtasks',
    compLabels: 'Labels / Tags',
    compDueDates: 'Due Dates',
    compCalendar: 'Calendar View',
    compTimeline: 'Timeline View',
    compTemplates: 'Ticket Templates',
    compSearch: 'Global Search',
    compExport: 'CSV / PDF Export',
    compWebhooks: 'Webhooks',
    compKeyboardShortcuts: 'Keyboard Shortcuts',
    compMarkdown: 'Markdown',
    compSelfHosted: 'Self-hosted',
    compFreeTier: 'Free Tier',
    compPartial: 'Partial',
    compPaid: 'Paid',

    pricingTitle: 'Simple and transparent pricing',
    pricingSub: 'Choose the plan that fits your needs.',
    pricingFree: 'Free',
    pricingFreePrice: '0$',
    pricingPro: 'Pro',
    pricingProPrice: '49$',
    pricingEnterprise: 'Enterprise',
    pricingEnterprisePrice: 'Custom',
    pricingChoose: 'Choose',
    pricingContact: 'Contact us',
    pricingFeatureTickets: 'tickets / month',
    pricingFeaturePipelines: 'concurrent pipeline(s)',
    pricingFeatureSupport: 'Community support',
    pricingFeaturePriority: 'Priority queue',
    pricingFeatureDedicated: 'Dedicated support',
    pricingPerMonth: '/ month',

    contactTitle: 'Contact us',
    contactSub: 'Have a question or suggestion? Send us a message.',
    contactName: 'Name',
    contactEmail: 'Email',
    contactMessage: 'Message',
    contactSend: 'Send',
    contactSending: 'Sending...',
    contactSuccess: 'Message sent successfully! We\'ll get back to you shortly.',

    legalTitle: 'Legal Notice & Terms',
    privacyTitle: 'Privacy Policy',

    notFoundTitle: 'Page not found',
    notFoundDesc: 'The page you\'re looking for doesn\'t exist or has been moved.',
    notFoundBack: 'Back to home',

    footerRights: '© 2026 CrabCreate. All rights reserved.',
    footerLegal: 'Legal notice',
    footerPrivacy: 'Privacy',

    userMenuTheme: 'Theme',
    userMenuLang: 'Language',
    userMenuAnimations: 'Animations',
    userMenuAIDesign: 'AI Design',
    userMenuMascot: 'Mascot',
    userMenuSettings: 'Settings',

    adminTitle: 'Administration',
    adminUsers: 'Users',
    adminContacts: 'Messages',
    adminSettings: 'Settings',
    adminStats: 'Statistics',
    adminEmail: 'Email',
    adminPlan: 'Plan',
    adminBlocked: 'Blocked',
    adminLastLogin: 'Last login',
    adminCreatedAt: 'Registered',
    adminBlock: 'Block',
    adminUnblock: 'Unblock',
    adminBlockReason: 'Block reason',
    adminNoUsers: 'No users.',
    adminNoContacts: 'No contact messages.',
    adminTotalUsers: 'Users',
    adminActiveUsers: 'Active',
    adminBlockedUsers: 'Blocked',
    adminTotalTickets: 'Total tickets',
    adminTotalCost: 'Total cost',
    adminTotalTokens: 'Total tokens',
    adminFree: 'Free',
    adminPro: 'Pro',
    adminEnterprise: 'Enterprise',
    adminActions: 'Actions',
    adminRole: 'Role',
    adminUser: 'User',
    adminAdmin: 'Admin',
    adminDeleteMsg: 'Delete',
    adminFrom: 'From',
    adminMessage: 'Message',
    adminDate: 'Date',
    adminLogs: 'Logs',
    adminNoLogs: 'No logs',
    adminLogAction: 'Action',
    adminLogUser: 'User',
    adminLogEntity: 'Entity',
    adminLogDetails: 'Details',
    adminLogDate: 'Date',
    adminLogIp: 'IP',
    adminLoadMore: 'Load more',
    adminLogFilterAll: 'All',
    adminLogFilterAuth: 'Auth',
    adminLogFilterTicket: 'Tickets',
    adminLogFilterPipeline: 'Pipeline',
    adminLogFilterAdmin: 'Admin',
    adminLogFilterFeedback: 'Guide Reviews',
    adminLogFilterProject: 'Projects',
    adminLogFilterDelete: 'Deletions',

    settingsCatRateLimiting: 'Rate Limiting',
    settingsCatIA: 'Artificial Intelligence',
    settingsCatSecurity: 'Security',
    settingsCatPipeline: 'Pipeline',
    settingsCatMaintenance: 'Maintenance',

    settingsDefaultModel: 'Default AI model',
    settingsDefaultModelDesc: 'Model used by default for new tickets',
    settingsReviewThreshold: 'AI review threshold',
    settingsReviewThresholdDesc: 'Minimum score to pass review (auto-reject below)',
    settingsMaxTokens: 'Max tokens (generation)',
    settingsMaxTokensDesc: 'Maximum tokens for code generation',

    settingsDevLogin: 'Dev login',
    settingsDevLoginDesc: 'Enable fast login in development mode',
    settingsRegistration: 'Registration',
    settingsRegistrationDesc: 'Allow new user registrations',
    settingsSessionDuration: 'Session duration (days)',
    settingsSessionDurationDesc: 'JWT session validity duration',

    settingsAutoTest: 'Auto tests',
    settingsAutoTestDesc: 'Run tests automatically in the pipeline',
    settingsAutoDeploy: 'Auto deploy',
    settingsAutoDeployDesc: 'Deploy automatically to staging after tests',

    settingsMaintenanceMode: 'Maintenance mode',
    settingsMaintenanceModeDesc: 'Block access except for administrators',
    settingsLogRetention: 'Log retention (days)',
    settingsLogRetentionDesc: 'How long to keep audit logs',

    settingsCatPlans: 'Plans',
    settingsTicketsPerMonth: 'Tickets / month',
    settingsPipelinesPerPlan: 'Concurrent pipelines',
    settingsProjectsPerPlan: 'Max projects',
    settingsMembersPerProject: 'Members / project',
    settingsUnlimited: 'Unlimited',

    settingsCatModels: 'AI Models & Costs',
    settingsClaudeVersion: 'Claude version',
    settingsClaudeVersionDesc: 'Anthropic model identifier (e.g. claude-opus-4-6)',
    settingsGptVersion: 'GPT version',
    settingsGptVersionDesc: 'OpenAI model identifier (e.g. gpt-5.3)',
    settingsCostClaude: 'Cost/token Claude',
    settingsCostClaudeDesc: 'Price per token for cost tracking ($)',
    settingsCostGpt: 'Cost/token GPT',
    settingsCostGptDesc: 'Price per token for cost tracking ($)',
    settingsTokensComplexity: 'Tokens (estimation)',
    settingsTokensComplexityDesc: 'Max tokens for complexity estimation',
    settingsTokensChat: 'Tokens (chat)',
    settingsTokensChatDesc: 'Max tokens for AI chat responses',
    settingsTokensReview: 'Tokens (review)',
    settingsTokensReviewDesc: 'Max tokens for AI code review',

    settingsAuthCodeExpiry: 'Code expiry (min)',
    settingsAuthCodeExpiryDesc: 'Login code validity duration',
    settingsAuthCodeLimit: 'Code request limit',
    settingsAuthCodeLimitDesc: 'Max code requests per window',
    settingsAuthCodeWindow: 'Code window (min)',
    settingsAuthCodeWindowDesc: 'Rate limit window for code requests',
    settingsAuthVerifyLimit: 'Verify limit',
    settingsAuthVerifyLimitDesc: 'Max verification attempts per window',
    settingsAuthVerifyWindow: 'Verify window (min)',
    settingsAuthVerifyWindowDesc: 'Rate limit window for code verification',
    settingsContactLimit: 'Contact msg limit',
    settingsContactLimitDesc: 'Max contact messages per window',
    settingsContactWindow: 'Contact window (min)',
    settingsContactWindowDesc: 'Rate limit window for contact form',

    settingsCatGit: 'Git & Deploy',
    settingsGitDefaultBranch: 'Source branch',
    settingsGitDefaultBranchDesc: 'Source branch for clone/pull (master, main...)',
    settingsGitTargetBranch: 'Target branch (PR)',
    settingsGitTargetBranchDesc: 'Target branch for Pull Requests (develop, main...)',
    settingsGitMergeStrategy: 'Merge strategy',
    settingsGitMergeStrategyDesc: 'Pull Request merge method',
    settingsGitCloseBranch: 'Close source branch',
    settingsGitCloseBranchDesc: 'Delete source branch after PR merge',
    settingsBranchMaxLength: 'Max branch name length',
    settingsBranchMaxLengthDesc: 'Maximum length of generated branch names',

    settingsCatAutoRepo: 'Auto Git Repo',
    settingsAutoRepoEnabled: 'Auto-repo enabled',
    settingsAutoRepoEnabledDesc: 'Automatically create a GitHub repo when a project is created',
    settingsAutoRepoDefaultPrivate: 'Private repos',
    settingsAutoRepoDefaultPrivateDesc: 'Auto repos are created as private by default',
    autoRepoCreating: 'Creating GitHub repo...',
    autoRepoSuccess: 'GitHub repo created!',
    autoRepoFailed: 'Auto-repo creation failed',
    autoRepoManualSetup: 'You can configure it manually in project settings',
    repoOptionAuto: 'Create a GitHub repo',
    repoOptionAutoDesc: 'A repo will be created automatically',
    repoOptionManual: 'Configure later',
    repoOptionManualDesc: 'Connect an existing repo after creation',
    repoOptionNone: 'No repo',
    repoOptionNoneDesc: 'Configure the repo manually later',
    repoSetupLabel: 'Git Repository',

    settingsQueuePolling: 'Queue polling (ms)',
    settingsQueuePollingDesc: 'Dependency queue check interval',
    settingsTestMultiplier: 'Tests per file',
    settingsTestMultiplierDesc: 'Number of generated tests per modified file',

    settingsCatInterface: 'Interface',
    settingsAuditLogLimit: 'Logs per page',
    settingsAuditLogLimitDesc: 'Default number of audit logs displayed',
    settingsAuditLogMaxLimit: 'Max logs per request',
    settingsAuditLogMaxLimitDesc: 'Maximum audit logs loadable per request',
    settingsNotifTimeout: 'Notification timeout (ms)',
    settingsNotifTimeoutDesc: 'Toast notification display duration',
    settingsScoreGood: 'Green score threshold',
    settingsScoreGoodDesc: 'Minimum score to display as green (good)',
    settingsScoreOk: 'Orange score threshold',
    settingsScoreOkDesc: 'Minimum score to display as orange (acceptable)',
    settingsActivityPreview: 'Activity preview (chars)',
    settingsActivityPreviewDesc: 'Message preview length in activity logs',

    settingsEnabled: 'Enabled',
    settingsDisabled: 'Disabled',

    billingSubscribe: 'Subscribe',
    billingManage: 'Manage current subscription',
    billingCurrentPlan: 'Current plan',
    billingUpgradeToPro: 'Upgrade to Pro',
    billingAlreadyOnPro: 'You are already subscribed to the Pro plan.',
    billingCheckoutSuccess: 'Pro subscription activated successfully!',
    billingCheckoutCanceled: 'Payment canceled.',
    billingPlanLimitTickets: 'Ticket limit reached for your plan.',
    billingPlanLimitPipelines: 'Pipeline limit reached for your plan.',
    billingPlanLimitProjects: 'Project limit reached for your plan.',
    billingPlanLimitMembers: 'Member limit reached for this project.',
    billingUpgradePrompt: 'Upgrade to Pro to increase your limits.',
    billingLoading: 'Redirecting to payment...',
    billingPortal: 'Billing portal',

    validationTitleHint: '3 to 200 characters',
    validationDescTicketHint: 'Max 5000 characters',
    validationProjectNameHint: '2 to 100 characters',
    validationSlugHint: 'Lowercase letters, numbers and hyphens only (e.g. my-project)',
    validationDescProjectHint: 'Max 500 characters',
    validationContactNameHint: 'Required',
    validationContactEmailHint: 'Valid email address',
    validationContactMsgHint: 'Max 5000 characters',
    validationCharsRemaining: 'characters remaining',

    adminStripeStatus: 'Stripe',

    projectsTitle: 'Projects',
    projectCreate: 'New project',
    projectName: 'Project name',
    projectSlug: 'Slug (URL)',
    projectDescription: 'Description',
    projectPrivate: 'Private',
    projectCollaborative: 'Collaborative',
    projectConnectRepo: 'Connect to an existing repo',
    projectConnectRepoDesc: 'GitHub / GitLab / Bitbucket · Database not included · Server deployment not included',
    projectNewComplete: 'New complete project',
    projectNewCompleteDesc: 'No starter code · Database created · Server deployment included',
    projectDefaultRepo: 'Default repository',
    projectSettings: 'Project settings',
    projectGeneral: 'General',
    projectMembers: 'Members',
    projectDangerZone: 'Danger zone',
    projectDelete: 'Delete project',
    projectDeleteConfirm: 'Delete this project and all its tickets? This action is irreversible.',
    projectTransferOwnership: 'Transfer ownership',
    projectTransferConfirm: 'Are you sure you want to transfer ownership?',
    projectInvite: 'Invite a member',
    projectInviteEmail: 'Member email',
    projectInviteRole: 'Role',
    projectInviteSend: 'Send invitation',
    projectInvitations: 'Invitations',
    projectNoInvitations: 'No pending invitations.',
    projectAccept: 'Accept',
    projectReject: 'Decline',
    projectRemoveMember: 'Remove',
    projectChangeRole: 'Change role',
    projectNoProjects: 'No projects',
    projectCreateFirst: 'Create your first project to get started.',
    projectRoleOwner: 'Owner',
    projectRoleAdmin: 'Admin',
    projectRoleMember: 'Member',
    projectRoleViewer: 'Viewer',
    projectSwitchTo: 'Switch project',
    projectInvitationsBadge: 'Invitations',

    usersOnline: '{count} user(s) online',
    projectCollaboration: 'Collaboration',
    projectCursorsEnabled: 'Live cursors',
    projectCursorsEnabledDesc: 'See other members\' cursors in real time',
    projectPresenceEnabled: 'Online presence',
    projectPresenceEnabledDesc: 'Show connected members\' avatars in the header',
    projectPresenceMax: 'Max visible avatars',
    projectPresenceMaxDesc: 'Maximum number of avatars shown before the +N counter',

    tabComments: 'Comments',
    commentsEmpty: 'No comments yet. Be the first to comment.',
    commentsPlaceholder: 'Write a comment... (@email to mention)',
    commentsSend: 'Send',
    commentsEdit: 'Edit',
    commentsDelete: 'Delete',
    commentsEdited: '(edited)',
    commentsMentionHint: 'Use @email to mention a member',
    commentsTyping: 'is typing...',
    commentsEditingLock: 'is editing this ticket',
    watchTicket: 'Watch',
    unwatchTicket: 'Unwatch',
    watchersCount: '{count} watcher(s)',
    notificationsTitle: 'Notifications',
    notificationsEmpty: 'No notifications.',
    notificationsMarkAllRead: 'Mark all as read',
    notificationsMention: 'Mention',
    notificationsComment: 'Comment',
    notificationsStatusChange: 'Status change',
    userStatusAvailable: 'Available',
    userStatusBusy: 'Busy',
    userStatusAway: 'Away',
    viewingTicket: 'is viewing this ticket',
    draggingTicket: 'is moving this ticket',
    reactionsAdd: 'React',

    colTasks: 'Tasks',
    colWaiting: 'Waiting',
    colEstimation: 'Estimation',
    colAiCoding: 'AI Coding',
    colAiReview: 'AI Review',
    colAiTests: 'AI Tests',
    colDeploy: 'Deploy',
    colStaging: 'Staging',
    colReview: 'Review',
    colApproved: 'Approved',
    colRejected: 'Rejected',

    filterStatus: 'Status',
    filterPriority: 'Priority',
    filterAssignee: 'Assignee',
    filterDueDate: 'Due date',
    filterLabel: 'Label',
    filterClear: 'Clear filters',
    filterAll: 'All',

    columnTimesTitle: 'Time per column',

    dueDate: 'Due date',
    dueDateSet: 'Set due date',
    dueDateClear: 'Clear due date',
    dueDateOverdue: 'Overdue',
    dueDateToday: 'Today',
    dueDateNone: 'No due date',
    dueDateThisWeek: 'This week',

    labels: 'Labels',
    labelCreate: 'Create label',
    labelEdit: 'Edit label',
    labelDelete: 'Delete label',
    labelColor: 'Color',
    labelName: 'Label name',
    labelNone: 'No labels',

    subtasks: 'Subtasks',
    subtaskAdd: 'Add subtask',
    subtaskPlaceholder: 'New subtask...',
    subtaskProgress: '{done}/{total} completed',
    subtaskEmpty: 'No subtasks.',

    favorites: 'Favorites',
    favoriteAdd: 'Add to favorites',
    favoriteRemove: 'Remove from favorites',
    favoritesEmpty: 'No favorites.',

    ticketTemplates: 'Ticket templates',
    templateCreate: 'Create template',
    templateEdit: 'Edit template',
    templateDelete: 'Delete template',
    templateApply: 'Apply template',
    templateName: 'Template name',
    templateEmpty: 'No templates.',

    globalSearch: 'Global search',
    searchResults: 'Results',
    searchNoResults: 'No results found.',
    searchTickets: 'Tickets',
    searchComments: 'Comments',
    searchActivity: 'Activity',

    keyboardShortcuts: 'Keyboard shortcuts',
    shortcutNewTicket: 'New ticket',
    shortcutSearch: 'Search',
    shortcutNextTicket: 'Next ticket',
    shortcutPrevTicket: 'Previous ticket',

    activityPage: 'Project activity',
    activityGlobal: 'Global activity',
    activityEmpty: 'No recent activity.',
    activityFilter: 'Filter by type',

    markdownPreview: 'Preview',
    markdownEdit: 'Edit',
    markdownHelp: 'Markdown supported',

    historyTitle: 'History',
    historyAll: 'All',
    historyCompleted: 'Completed',
    historyActive: 'Active',
    historyArchived: 'Archived',
    listTitle: 'Title',
    listStatus: 'Status',
    listProgress: 'Progress',
    historyEmpty: 'No tickets found',

    exportCSV: 'Export CSV',
    exportPDF: 'Export PDF',
    exportHTML: 'Export HTML',
    exportTitle: 'Export',

    reactions: 'Reactions',
    reactionAdd: 'Add reaction',

    webhooks: 'Webhooks',
    webhookCreate: 'Create webhook',
    webhookEdit: 'Edit webhook',
    webhookDelete: 'Delete webhook',
    webhookUrl: 'URL',
    webhookEvents: 'Events',
    webhookSecret: 'Secret',
    webhookEnabled: 'Enabled',
    webhookEmpty: 'No webhooks configured.',

    viewCalendar: 'Calendar',
    viewTimeline: 'Timeline',
    viewBoard: 'Board',
    viewList: 'List',

    emailNotifications: 'Email notifications',
    emailMention: 'Email notification on mention',
    emailStatusChange: 'Email notification on status change',

    pipelineStep: 'Step',
    viewSite: 'View site',

    setupTitle: 'Configure project',
    setupRepoDesc: 'Connect a Git repository to enable the AI pipeline.',
    setupConnectExisting: 'Connect a repo',
    setupConnectExistingDesc: 'Existing GitHub, GitLab or Bitbucket repo',
    setupCreateNew: 'Create a repo',
    setupCreateNewDesc: 'Create a new repository automatically',
    setupProvider: 'Git Provider',
    setupToken: 'Personal Access Token',
    setupOwner: 'Owner / Organization',
    setupRepoName: 'Repository name',
    setupBranch: 'Default branch',
    setupSourceBranch: 'Source branch (pull)',
    setupTargetBranch: 'Target branch (PR)',
    setupTestConnection: 'Test connection',
    setupTestConnectionSuccess: 'Connection successful!',
    setupTestConnectionFail: 'Connection failed',
    setupTesting: 'Testing...',
    setupBack: 'Back',
    setupConnect: 'Connect',
    setupCreateRepo: 'Create repo',
    setupPrivate: 'Private',
    setupPublic: 'Public',
    setupRepoSuccess: 'Git repo connected successfully!',
    setupDeployDesc: 'Configure automatic deployment (optional).',
    setupCfToken: 'Cloudflare API Token',
    setupCfAccountId: 'Cloudflare Account ID',
    setupCfInfo: 'A Cloudflare Pages project will be created automatically. Multi-tenant Supabase DB included.',
    setupSkipDeploy: 'Skip this step',
    setupConfigureDeploy: 'Configure',
    setupProjectNotConfigured: 'Project not configured',
    compareBtn: 'Compare',
    compareBefore: 'Before (Production)',
    compareAfter: 'After (Preview)',
    compareTitle: 'Before / After Comparison',
    compareNoProductionUrl: 'Production URL not configured',
    compareNoPreviewUrl: 'Preview URL not available',
    compareLoadingPreview: 'Loading preview...',
    archivedOn: 'Archived on',
    viewChanges: 'View changes',
  },
};
