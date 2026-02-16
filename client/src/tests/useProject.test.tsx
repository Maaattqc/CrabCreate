import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Project, ProjectInvitation } from '../types';

// Mock useAuth before importing ProjectProvider
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, email: 'test@example.com', isAdmin: false, plan: 'free', stripeSubscriptionStatus: null, preferences: {} }, loading: false }),
}));

import { ProjectProvider, useProject } from '../hooks/useProject';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ProjectProvider>{children}</ProjectProvider>
);

const mockProject: Project = {
  id: 1,
  name: 'Test Project',
  description: 'A test project',
  slug: 'test-project',
  owner_id: 1,
  is_private: 1,
  default_repo: 'main-site',
  setup_completed: 0,
  cursors_enabled: 1,
  presence_enabled: 1,
  presence_max_visible: 5,
  cf_site_url: null,
  role: 'owner',
  created_at: '2025-01-01',
  updated_at: '2025-01-01',
};

const mockProject2: Project = {
  id: 2,
  name: 'Second Project',
  description: '',
  slug: 'second-project',
  owner_id: 1,
  is_private: 0,
  default_repo: 'main-site',
  setup_completed: 0,
  cursors_enabled: 1,
  presence_enabled: 1,
  presence_max_visible: 5,
  cf_site_url: null,
  role: 'admin',
  created_at: '2025-01-02',
  updated_at: '2025-01-02',
};

const mockInvitation: ProjectInvitation = {
  id: 1,
  project_id: 3,
  email: 'user@example.com',
  role: 'member',
  token: 'inv-token-123',
  status: 'pending',
  expires_at: '2099-01-01',
  created_at: '2025-01-01',
  project_name: 'Other Project',
  inviter_email: 'owner@example.com',
};

// Mock the projects API
vi.mock('../api/projects', () => ({
  getProjects: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getMyInvitations: vi.fn(),
  acceptInvitation: vi.fn(),
  rejectInvitation: vi.fn(),
}));

import * as projectsApi from '../api/projects';

describe('useProject', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('initial state: loading true, projects empty', () => {
    // Mock API to hang
    vi.mocked(projectsApi.getProjects).mockReturnValue(new Promise(() => {}));
    vi.mocked(projectsApi.getMyInvitations).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useProject(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.projects).toEqual([]);
    expect(result.current.currentProject).toBeNull();
  });

  it('loads projects and selects the first one', async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValue([mockProject, mockProject2]);
    vi.mocked(projectsApi.getMyInvitations).mockResolvedValue([]);

    const { result } = renderHook(() => useProject(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.projects).toHaveLength(2);
    expect(result.current.currentProject).toEqual(mockProject);
    expect(localStorage.getItem('crab-current-project')).toBe('1');
  });

  it('restores last used project from localStorage', async () => {
    localStorage.setItem('crab-current-project', '2');

    vi.mocked(projectsApi.getProjects).mockResolvedValue([mockProject, mockProject2]);
    vi.mocked(projectsApi.getMyInvitations).mockResolvedValue([]);

    const { result } = renderHook(() => useProject(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.currentProject).toEqual(mockProject2);
  });

  it('falls back to first project if saved id is no longer valid', async () => {
    localStorage.setItem('crab-current-project', '999');

    vi.mocked(projectsApi.getProjects).mockResolvedValue([mockProject]);
    vi.mocked(projectsApi.getMyInvitations).mockResolvedValue([]);

    const { result } = renderHook(() => useProject(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.currentProject).toEqual(mockProject);
  });

  it('auto-creates a default project when list is empty', async () => {
    const autoProject: Project = {
      ...mockProject,
      id: 10,
      name: 'Mon projet',
      slug: 'projet-1',
    };
    vi.mocked(projectsApi.getProjects).mockResolvedValue([]);
    vi.mocked(projectsApi.getMyInvitations).mockResolvedValue([]);
    vi.mocked(projectsApi.createProject).mockResolvedValue(autoProject);

    const { result } = renderHook(() => useProject(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(projectsApi.createProject).toHaveBeenCalledWith({
      name: 'Mon projet',
      slug: 'projet-1',
      is_private: 1,
    });
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.currentProject).toEqual(autoProject);
  });

  it('loads invitations on mount', async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValue([mockProject]);
    vi.mocked(projectsApi.getMyInvitations).mockResolvedValue([mockInvitation]);

    const { result } = renderHook(() => useProject(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.invitations).toHaveLength(1);
    expect(result.current.invitations[0].token).toBe('inv-token-123');
  });

  it('switchProject changes the current project and saves to localStorage', async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValue([mockProject, mockProject2]);
    vi.mocked(projectsApi.getMyInvitations).mockResolvedValue([]);

    const { result } = renderHook(() => useProject(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.switchProject(mockProject2);
    });

    expect(result.current.currentProject).toEqual(mockProject2);
    expect(localStorage.getItem('crab-current-project')).toBe('2');
  });

  it('createProject calls API, adds to list, and switches to new project', async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValue([mockProject]);
    vi.mocked(projectsApi.getMyInvitations).mockResolvedValue([]);
    vi.mocked(projectsApi.createProject).mockResolvedValue(mockProject2);

    const { result } = renderHook(() => useProject(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let created: Project | undefined;
    await act(async () => {
      created = await result.current.createProject({
        name: 'Second Project',
        slug: 'second-project',
      });
    });

    expect(created).toEqual(mockProject2);
    expect(result.current.projects).toHaveLength(2);
    expect(result.current.currentProject).toEqual(mockProject2);
    expect(projectsApi.createProject).toHaveBeenCalledWith({
      name: 'Second Project',
      slug: 'second-project',
    });
  });

  it('updateProject calls API and updates state', async () => {
    const updatedProject = { ...mockProject, name: 'Updated Name' };
    vi.mocked(projectsApi.getProjects).mockResolvedValue([mockProject]);
    vi.mocked(projectsApi.getMyInvitations).mockResolvedValue([]);
    vi.mocked(projectsApi.updateProject).mockResolvedValue(updatedProject);

    const { result } = renderHook(() => useProject(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateProject(1, { name: 'Updated Name' });
    });

    expect(result.current.projects[0].name).toBe('Updated Name');
    expect(result.current.currentProject?.name).toBe('Updated Name');
  });

  it('deleteProject calls API and removes from state', async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValue([mockProject, mockProject2]);
    vi.mocked(projectsApi.getMyInvitations).mockResolvedValue([]);
    vi.mocked(projectsApi.deleteProject).mockResolvedValue(undefined);

    const { result } = renderHook(() => useProject(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteProject(1);
    });

    expect(result.current.projects).toHaveLength(1);
    // Should switch to the next available project
    expect(result.current.currentProject).toEqual(mockProject2);
  });

  it('acceptInvitation calls API and removes from invitations list', async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValue([mockProject]);
    vi.mocked(projectsApi.getMyInvitations).mockResolvedValue([mockInvitation]);
    vi.mocked(projectsApi.acceptInvitation).mockResolvedValue(undefined);

    const { result } = renderHook(() => useProject(), { wrapper });

    await waitFor(() => {
      expect(result.current.invitations).toHaveLength(1);
    });

    await act(async () => {
      await result.current.acceptInvitation('inv-token-123');
    });

    expect(projectsApi.acceptInvitation).toHaveBeenCalledWith('inv-token-123');
    expect(result.current.invitations).toHaveLength(0);
  });

  it('rejectInvitation calls API and removes from invitations list', async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValue([mockProject]);
    vi.mocked(projectsApi.getMyInvitations).mockResolvedValue([mockInvitation]);
    vi.mocked(projectsApi.rejectInvitation).mockResolvedValue(undefined);

    const { result } = renderHook(() => useProject(), { wrapper });

    await waitFor(() => {
      expect(result.current.invitations).toHaveLength(1);
    });

    await act(async () => {
      await result.current.rejectInvitation('inv-token-123');
    });

    expect(projectsApi.rejectInvitation).toHaveBeenCalledWith('inv-token-123');
    expect(result.current.invitations).toHaveLength(0);
  });

  it('handles API errors gracefully for getProjects (auto-create also fails)', async () => {
    vi.mocked(projectsApi.getProjects).mockRejectedValue(new Error('Network error'));
    vi.mocked(projectsApi.getMyInvitations).mockResolvedValue([]);
    vi.mocked(projectsApi.createProject).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useProject(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.projects).toHaveLength(0);
    expect(result.current.currentProject).toBeNull();
  });

  it('handles API errors gracefully for getMyInvitations', async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValue([mockProject]);
    vi.mocked(projectsApi.getMyInvitations).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useProject(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.invitations).toHaveLength(0);
  });
});
