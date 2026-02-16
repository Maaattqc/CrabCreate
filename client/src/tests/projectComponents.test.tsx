import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mock useLanguage ─────────────────────────────────────────────────────────

vi.mock('../hooks/useLanguage', () => ({
  useLanguage: () => ({
    lang: 'fr',
    t: {
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
      projectSettings: 'Paramètres du projet',
      projectGeneral: 'Général',
      projectMembers: 'Membres',
      projectDangerZone: 'Zone danger',
      projectDelete: 'Supprimer le projet',
      projectDeleteConfirm: 'Confirmer la suppression',
      projectTransferOwnership: 'Transférer la propriété',
      projectTransferConfirm: 'Confirmer le transfert',
      projectInvite: 'Inviter un membre',
      projectInviteEmail: 'Email du membre',
      projectInviteRole: 'Rôle',
      projectInviteSend: "Envoyer l'invitation",
      projectInvitations: 'Invitations',
      projectNoInvitations: 'Aucune invitation en attente.',
      projectAccept: 'Accepter',
      projectReject: 'Refuser',
      projectRemoveMember: 'Retirer',
      projectChangeRole: 'Changer le rôle',
      projectNoProjects: 'Aucun projet',
      projectCreateFirst: 'Créez votre premier projet.',
      projectRoleOwner: 'Propriétaire',
      projectRoleAdmin: 'Admin',
      projectRoleMember: 'Membre',
      projectRoleViewer: 'Lecteur',
      projectSwitchTo: 'Passer à',
      projectInvitationsBadge: 'Invitations',
      cancel: 'Annuler',
      continueBtn: 'Continuer',
      create: 'Créer',
      creating: 'Création...',
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      loading: 'Chargement...',
      billingPlanLimitProjects: 'Limite de projets atteinte',
      validationProjectNameHint: '2 caractères minimum',
      validationSlugHint: 'Lettres minuscules, chiffres et tirets',
      validationDescProjectHint: 'Optionnel',
      validationCharsRemaining: 'caractères restants',
      setupProvider: 'Fournisseur',
      setupToken: 'Token',
      setupOwner: 'Propriétaire',
      setupRepoName: 'Nom du repo',
      setupBranch: 'Branche',
    },
    setLang: vi.fn(),
  }),
}));

// ── Mock useProject ──────────────────────────────────────────────────────────

const mockCreateProject = vi.fn();
const mockAcceptInvitation = vi.fn();
const mockRejectInvitation = vi.fn();

vi.mock('../hooks/useProject', () => ({
  useProject: () => ({
    projects: [],
    currentProject: { id: 1, name: 'Test Project', slug: 'test-project', owner_id: 1, is_private: 1, default_repo: 'main-site', cf_site_url: null, role: 'owner' },
    invitations: mockInvitations,
    loading: false,
    switchProject: vi.fn(),
    createProject: mockCreateProject,
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    refreshProjects: vi.fn(),
    refreshInvitations: vi.fn(),
    acceptInvitation: mockAcceptInvitation,
    rejectInvitation: mockRejectInvitation,
  }),
}));

// ── Mock connectRepo ─────────────────────────────────────────────────────────

const mockConnectRepo = vi.fn();

vi.mock('../api/project-setup', () => ({
  connectRepo: (...args: any[]) => mockConnectRepo(...args),
}));

let mockInvitations: any[] = [];

import CreateProjectModal from '../components/modals/CreateProjectModal';
import InvitationsModal from '../components/modals/InvitationsModal';

// ═══════════════════════════════════════════════════════════════════════════════
// CreateProjectModal
// ═══════════════════════════════════════════════════════════════════════════════

describe('CreateProjectModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the choice screen with two options', () => {
    render(<CreateProjectModal onClose={vi.fn()} />);

    expect(screen.getByText('Nouveau projet')).toBeInTheDocument();
    expect(screen.getByText('Se connecter à un repo existant')).toBeInTheDocument();
    expect(screen.getByText(/GitHub \/ GitLab \/ Bitbucket/)).toBeInTheDocument();
    expect(screen.getByText('Nouveau projet complet')).toBeInTheDocument();
    expect(screen.getByText(/Aucun code de départ/)).toBeInTheDocument();
  });

  it('shows project form when "Nouveau projet complet" is clicked', () => {
    render(<CreateProjectModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Nouveau projet complet'));

    expect(screen.getByText(/Nom du projet/)).toBeInTheDocument();
    expect(screen.getByText(/Slug \(URL\)/)).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Privé')).toBeInTheDocument();
    expect(screen.getByText('Collaboratif')).toBeInTheDocument();
  });

  it('shows git fields + project form when "Se connecter à un repo existant" is clicked', () => {
    render(<CreateProjectModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Se connecter à un repo existant'));

    // Git fields
    expect(screen.getByText('Fournisseur')).toBeInTheDocument();
    expect(screen.getByText('Token')).toBeInTheDocument();
    expect(screen.getByText('Propriétaire')).toBeInTheDocument();
    expect(screen.getByText('Nom du repo')).toBeInTheDocument();
    expect(screen.getByText('Branche')).toBeInTheDocument();

    // Project fields
    expect(screen.getByText(/Nom du projet/)).toBeInTheDocument();
    expect(screen.getByText(/Slug \(URL\)/)).toBeInTheDocument();
  });

  it('has a disabled submit button when fields are empty', () => {
    render(<CreateProjectModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Nouveau projet complet'));

    const submitBtn = screen.getByText('Créer');
    expect(submitBtn).toBeDisabled();
  });

  it('auto-generates slug from name', () => {
    render(<CreateProjectModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Nouveau projet complet'));

    const nameInput = screen.getByPlaceholderText('Mon super projet');
    fireEvent.change(nameInput, { target: { value: 'My New Project' } });

    const slugInput = screen.getByPlaceholderText('mon-super-projet') as HTMLInputElement;
    expect(slugInput.value).toBe('my-new-project');
  });

  it('enables submit button when name and slug are filled', () => {
    render(<CreateProjectModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Nouveau projet complet'));

    const nameInput = screen.getByPlaceholderText('Mon super projet');
    fireEvent.change(nameInput, { target: { value: 'Test' } });

    const submitBtn = screen.getByText('Créer');
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls createProject and onClose on successful submit (new mode)', async () => {
    mockCreateProject.mockResolvedValue({ id: 2, name: 'New', slug: 'new' });
    const onClose = vi.fn();

    render(<CreateProjectModal onClose={onClose} />);

    fireEvent.click(screen.getByText('Nouveau projet complet'));

    const nameInput = screen.getByPlaceholderText('Mon super projet');
    fireEvent.change(nameInput, { target: { value: 'New Project' } });

    const submitBtn = screen.getByText('Créer');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({
        name: 'New Project',
        slug: 'new-project',
        description: '',
        is_private: 1,
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('calls createProject + connectRepo on successful submit (connect mode)', async () => {
    mockCreateProject.mockResolvedValue({ id: 5, name: 'Connected', slug: 'connected' });
    mockConnectRepo.mockResolvedValue({ success: true, repoId: 'repo-1' });
    const onClose = vi.fn();

    render(<CreateProjectModal onClose={onClose} />);

    fireEvent.click(screen.getByText('Se connecter à un repo existant'));

    // Fill git fields
    fireEvent.change(screen.getByPlaceholderText('ghp_xxxx... / glpat-xxxx...'), { target: { value: 'ghp_test123' } });
    fireEvent.change(screen.getByPlaceholderText('my-org'), { target: { value: 'my-org' } });
    fireEvent.change(screen.getByPlaceholderText('my-app'), { target: { value: 'my-repo' } });

    // Fill project fields
    fireEvent.change(screen.getByPlaceholderText('Mon super projet'), { target: { value: 'Connected' } });

    fireEvent.click(screen.getByText('Créer'));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalled();
      expect(mockConnectRepo).toHaveBeenCalledWith({
        provider: 'github',
        owner: 'my-org',
        repo: 'my-repo',
        token: 'ghp_test123',
        branch: 'main',
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('displays error on submit failure', async () => {
    mockCreateProject.mockRejectedValue(new Error('Slug already taken'));
    const onClose = vi.fn();

    render(<CreateProjectModal onClose={onClose} />);

    fireEvent.click(screen.getByText('Nouveau projet complet'));

    const nameInput = screen.getByPlaceholderText('Mon super projet');
    fireEvent.change(nameInput, { target: { value: 'Fail Project' } });

    const submitBtn = screen.getByText('Créer');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Slug already taken')).toBeInTheDocument();
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<CreateProjectModal onClose={onClose} />);

    fireEvent.click(screen.getByText('Nouveau projet complet'));
    fireEvent.click(screen.getByText('Annuler'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<CreateProjectModal onClose={onClose} />);

    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles between private and collaborative', async () => {
    render(<CreateProjectModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Nouveau projet complet'));

    const collaborativeBtn = screen.getByText('Collaboratif');
    fireEvent.click(collaborativeBtn);

    const nameInput = screen.getByPlaceholderText('Mon super projet');
    fireEvent.change(nameInput, { target: { value: 'Collab' } });

    mockCreateProject.mockResolvedValue({ id: 3, name: 'Collab', slug: 'collab' });
    fireEvent.click(screen.getByText('Créer'));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ is_private: 0 }),
      );
    });
  });

  it('goes back to choice screen when back arrow is clicked', () => {
    render(<CreateProjectModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Se connecter à un repo existant'));

    // Should be on git form
    expect(screen.getByText('Fournisseur')).toBeInTheDocument();

    // Click back arrow (ArrowLeft icon button)
    const backBtn = screen.getByText('Nouveau projet').closest('div')!.querySelector('button');
    fireEvent.click(backBtn!);

    // Should be back on choice screen
    expect(screen.getByText('Se connecter à un repo existant')).toBeInTheDocument();
    expect(screen.getByText('Nouveau projet complet')).toBeInTheDocument();
  });

  it('still closes even if connectRepo fails', async () => {
    mockCreateProject.mockResolvedValue({ id: 10, name: 'P', slug: 'p' });
    mockConnectRepo.mockRejectedValue(new Error('Bad token'));
    const onClose = vi.fn();

    render(<CreateProjectModal onClose={onClose} />);

    fireEvent.click(screen.getByText('Se connecter à un repo existant'));

    fireEvent.change(screen.getByPlaceholderText('ghp_xxxx... / glpat-xxxx...'), { target: { value: 'bad' } });
    fireEvent.change(screen.getByPlaceholderText('my-org'), { target: { value: 'org' } });
    fireEvent.change(screen.getByPlaceholderText('my-app'), { target: { value: 'repo' } });
    fireEvent.change(screen.getByPlaceholderText('Mon super projet'), { target: { value: 'P' } });

    fireEvent.click(screen.getByText('Créer'));

    await waitFor(() => {
      // Project was created, modal closed despite repo error
      expect(mockCreateProject).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// InvitationsModal
// ═══════════════════════════════════════════════════════════════════════════════

describe('InvitationsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvitations = [];
  });

  it('renders empty state when no invitations', () => {
    mockInvitations = [];
    render(<InvitationsModal onClose={vi.fn()} />);

    expect(screen.getByText('Invitations')).toBeInTheDocument();
    expect(screen.getByText('Aucune invitation en attente.')).toBeInTheDocument();
  });

  it('renders invitation cards when invitations exist', () => {
    mockInvitations = [
      {
        id: 1,
        project_id: 3,
        email: 'user@example.com',
        role: 'member',
        invited_by: 2,
        token: 'tok1',
        status: 'pending',
        expires_at: '2099-01-01',
        created_at: '2025-01-01',
        project_name: 'Cool Project',
        inviter_email: 'admin@example.com',
      },
    ];

    render(<InvitationsModal onClose={vi.fn()} />);

    expect(screen.getByText('Cool Project')).toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('Accepter')).toBeInTheDocument();
    expect(screen.getByText('Refuser')).toBeInTheDocument();
  });

  it('calls acceptInvitation when Accept button is clicked', async () => {
    mockAcceptInvitation.mockResolvedValue(undefined);
    mockInvitations = [
      {
        id: 1,
        project_id: 3,
        email: 'user@example.com',
        role: 'member',
        invited_by: 2,
        token: 'tok-accept',
        status: 'pending',
        expires_at: '2099-01-01',
        created_at: '2025-01-01',
        project_name: 'Accept Project',
        inviter_email: 'admin@example.com',
      },
    ];

    render(<InvitationsModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Accepter'));

    await waitFor(() => {
      expect(mockAcceptInvitation).toHaveBeenCalledWith('tok-accept');
    });
  });

  it('calls rejectInvitation when Reject button is clicked', async () => {
    mockRejectInvitation.mockResolvedValue(undefined);
    mockInvitations = [
      {
        id: 2,
        project_id: 4,
        email: 'user@example.com',
        role: 'admin',
        invited_by: 3,
        token: 'tok-reject',
        status: 'pending',
        expires_at: '2099-01-01',
        created_at: '2025-01-01',
        project_name: 'Reject Project',
        inviter_email: 'owner@example.com',
      },
    ];

    render(<InvitationsModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Refuser'));

    await waitFor(() => {
      expect(mockRejectInvitation).toHaveBeenCalledWith('tok-reject');
    });
  });

  it('renders multiple invitations', () => {
    mockInvitations = [
      {
        id: 1, project_id: 3, email: 'u@e.com', role: 'member', invited_by: 2,
        token: 't1', status: 'pending', expires_at: '2099-01-01', created_at: '2025-01-01',
        project_name: 'Project A', inviter_email: 'a@e.com',
      },
      {
        id: 2, project_id: 4, email: 'u@e.com', role: 'admin', invited_by: 3,
        token: 't2', status: 'pending', expires_at: '2099-01-01', created_at: '2025-01-01',
        project_name: 'Project B', inviter_email: 'b@e.com',
      },
    ];

    render(<InvitationsModal onClose={vi.fn()} />);

    expect(screen.getByText('Project A')).toBeInTheDocument();
    expect(screen.getByText('Project B')).toBeInTheDocument();
    expect(screen.getAllByText('Accepter')).toHaveLength(2);
    expect(screen.getAllByText('Refuser')).toHaveLength(2);
  });

  it('calls onClose when backdrop is clicked', () => {
    mockInvitations = [];
    const onClose = vi.fn();
    const { container } = render(<InvitationsModal onClose={onClose} />);

    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
