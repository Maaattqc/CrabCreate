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
      create: 'Créer',
      creating: 'Création...',
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      loading: 'Chargement...',
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
    currentProject: { id: 1, name: 'Test Project', slug: 'test-project', owner_id: 1, is_private: 1, default_repo: 'main-site', role: 'owner' },
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

  it('renders the create project form', () => {
    const onClose = vi.fn();
    render(<CreateProjectModal onClose={onClose} />);

    expect(screen.getByText('Nouveau projet')).toBeInTheDocument();
    expect(screen.getByText(/Nom du projet/)).toBeInTheDocument();
    expect(screen.getByText(/Slug \(URL\)/)).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Privé')).toBeInTheDocument();
    expect(screen.getByText('Collaboratif')).toBeInTheDocument();
  });

  it('has a disabled submit button when fields are empty', () => {
    render(<CreateProjectModal onClose={vi.fn()} />);

    const submitBtn = screen.getByText('Créer');
    expect(submitBtn).toBeDisabled();
  });

  it('auto-generates slug from name', () => {
    render(<CreateProjectModal onClose={vi.fn()} />);

    const nameInput = screen.getByPlaceholderText('Mon super projet');
    fireEvent.change(nameInput, { target: { value: 'My New Project' } });

    const slugInput = screen.getByPlaceholderText('mon-super-projet') as HTMLInputElement;
    expect(slugInput.value).toBe('my-new-project');
  });

  it('enables submit button when name and slug are filled', () => {
    render(<CreateProjectModal onClose={vi.fn()} />);

    const nameInput = screen.getByPlaceholderText('Mon super projet');
    fireEvent.change(nameInput, { target: { value: 'Test' } });

    const submitBtn = screen.getByText('Créer');
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls createProject and onClose on successful submit', async () => {
    mockCreateProject.mockResolvedValue({ id: 2, name: 'New', slug: 'new' });
    const onClose = vi.fn();

    render(<CreateProjectModal onClose={onClose} />);

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

  it('displays error on submit failure', async () => {
    mockCreateProject.mockRejectedValue(new Error('Slug already taken'));
    const onClose = vi.fn();

    render(<CreateProjectModal onClose={onClose} />);

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

    fireEvent.click(screen.getByText('Annuler'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<CreateProjectModal onClose={onClose} />);

    // Click on the backdrop (first fixed div)
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles between private and collaborative', async () => {
    render(<CreateProjectModal onClose={vi.fn()} />);

    const collaborativeBtn = screen.getByText('Collaboratif');
    fireEvent.click(collaborativeBtn);

    // Fill in required fields and submit to check the is_private value
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
