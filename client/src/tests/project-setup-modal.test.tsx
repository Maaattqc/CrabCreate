import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock useLanguage
vi.mock('../hooks/useLanguage', () => ({
  useLanguage: () => ({
    lang: 'fr',
    t: {
      setupTitle: 'Configurer le projet',
      setupRepoDesc: 'Connectez un dépôt Git pour activer la pipeline IA.',
      setupConnectExisting: 'Connecter un repo',
      setupConnectExistingDesc: 'Repo existant',
      setupCreateNew: 'Créer un repo',
      setupCreateNewDesc: 'Créer un nouveau dépôt',
      setupProvider: 'Provider Git',
      setupToken: 'Personal Access Token',
      setupOwner: 'Owner / Organisation',
      setupRepoName: 'Nom du repo',
      setupBranch: 'Branche par défaut',
      setupBack: 'Retour',
      setupConnect: 'Connecter',
      setupCreateRepo: 'Créer le repo',
      setupPrivate: 'Privé',
      setupPublic: 'Public',
      setupRepoSuccess: 'Repo Git connecté !',
      setupDeployDesc: 'Configurez le déploiement automatique.',
      setupCfToken: 'Cloudflare API Token',
      setupCfAccountId: 'Cloudflare Account ID',
      setupCfInfo: 'Un projet Pages sera créé.',
      setupSkipDeploy: 'Passer cette étape',
      setupConfigureDeploy: 'Configurer',
      setupProjectNotConfigured: 'Projet non configuré',
    },
    setLang: vi.fn(),
  }),
}));

// Mock project-setup API
const mockConnectRepo = vi.fn();
const mockCreateNewRepo = vi.fn();
const mockConfigureDeploy = vi.fn();
const mockSkipDeploy = vi.fn();

vi.mock('../api/project-setup', () => ({
  connectRepo: (...args: unknown[]) => mockConnectRepo(...args),
  createNewRepo: (...args: unknown[]) => mockCreateNewRepo(...args),
  configureDeploy: (...args: unknown[]) => mockConfigureDeploy(...args),
  skipDeploy: (...args: unknown[]) => mockSkipDeploy(...args),
}));

import ProjectSetupModal from '../components/modals/ProjectSetupModal';

describe('ProjectSetupModal', () => {
  const onClose = vi.fn();
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectRepo.mockResolvedValue({ success: true, repoId: 'proj-1' });
    mockCreateNewRepo.mockResolvedValue({ success: true, repoId: 'proj-1', webUrl: 'https://github.com/org/repo' });
    mockConfigureDeploy.mockResolvedValue({ success: true, siteUrl: 'https://test.pages.dev', tenantId: 'uuid' });
    mockSkipDeploy.mockResolvedValue({ success: true });
  });

  it('renders step 1 with mode selection', () => {
    render(<ProjectSetupModal onClose={onClose} onComplete={onComplete} />);

    expect(screen.getByText('Configurer le projet')).toBeInTheDocument();
    expect(screen.getByText('Connecter un repo')).toBeInTheDocument();
    expect(screen.getByText('Créer un repo')).toBeInTheDocument();
  });

  it('shows connect form when "Connecter un repo" is clicked', () => {
    render(<ProjectSetupModal onClose={onClose} onComplete={onComplete} />);

    fireEvent.click(screen.getByText('Connecter un repo'));

    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('GitLab')).toBeInTheDocument();
    expect(screen.getByText('Bitbucket')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('my-org')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('my-app')).toBeInTheDocument();
  });

  it('shows create form when "Créer un repo" is clicked', () => {
    render(<ProjectSetupModal onClose={onClose} onComplete={onComplete} />);

    fireEvent.click(screen.getByText('Créer un repo'));

    expect(screen.getByPlaceholderText('my-new-app')).toBeInTheDocument();
    expect(screen.getByText('Privé')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
  });

  it('goes back to mode selection when "Retour" is clicked', () => {
    render(<ProjectSetupModal onClose={onClose} onComplete={onComplete} />);

    fireEvent.click(screen.getByText('Connecter un repo'));
    expect(screen.getByPlaceholderText('my-org')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Retour'));
    expect(screen.getByText('Connecter un repo')).toBeInTheDocument();
  });

  it('calls connectRepo and moves to step 2 on successful connect', async () => {
    render(<ProjectSetupModal onClose={onClose} onComplete={onComplete} />);

    // Switch to connect mode
    fireEvent.click(screen.getByText('Connecter un repo'));

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('ghp_xxxx... / glpat-xxxx...'), { target: { value: 'my-token' } });
    fireEvent.change(screen.getByPlaceholderText('my-org'), { target: { value: 'test-org' } });
    fireEvent.change(screen.getByPlaceholderText('my-app'), { target: { value: 'test-repo' } });

    // Submit
    fireEvent.click(screen.getByText('Connecter'));

    await waitFor(() => {
      expect(mockConnectRepo).toHaveBeenCalledWith({
        provider: 'github',
        owner: 'test-org',
        repo: 'test-repo',
        token: 'my-token',
        branch: 'main',
      });
    });

    // Should show step 2
    await waitFor(() => {
      expect(screen.getByText('Repo Git connecté !')).toBeInTheDocument();
    });
  });

  it('shows error when connect fails', async () => {
    mockConnectRepo.mockRejectedValue(new Error('Token invalide'));
    render(<ProjectSetupModal onClose={onClose} onComplete={onComplete} />);

    fireEvent.click(screen.getByText('Connecter un repo'));
    fireEvent.change(screen.getByPlaceholderText('ghp_xxxx... / glpat-xxxx...'), { target: { value: 'bad-token' } });
    fireEvent.change(screen.getByPlaceholderText('my-org'), { target: { value: 'org' } });
    fireEvent.change(screen.getByPlaceholderText('my-app'), { target: { value: 'repo' } });

    fireEvent.click(screen.getByText('Connecter'));

    await waitFor(() => {
      expect(screen.getByText('Token invalide')).toBeInTheDocument();
    });
  });

  it('calls skipDeploy and completes on skip', async () => {
    // Start at step 2 by connecting repo first
    render(<ProjectSetupModal onClose={onClose} onComplete={onComplete} />);

    fireEvent.click(screen.getByText('Connecter un repo'));
    fireEvent.change(screen.getByPlaceholderText('ghp_xxxx... / glpat-xxxx...'), { target: { value: 'tok' } });
    fireEvent.change(screen.getByPlaceholderText('my-org'), { target: { value: 'org' } });
    fireEvent.change(screen.getByPlaceholderText('my-app'), { target: { value: 'repo' } });
    fireEvent.click(screen.getByText('Connecter'));

    await waitFor(() => {
      expect(screen.getByText('Passer cette étape')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Passer cette étape'));

    await waitFor(() => {
      expect(mockSkipDeploy).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it('calls onClose when backdrop is clicked', () => {
    const { container } = render(<ProjectSetupModal onClose={onClose} onComplete={onComplete} />);

    // Click backdrop (first child div)
    fireEvent.click(container.firstChild!);
    expect(onClose).toHaveBeenCalled();
  });
});
