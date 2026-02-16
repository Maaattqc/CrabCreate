import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as projectsApi from '../api/projects';
import { useAuth } from './useAuth';
import { useSocket } from './useSocket';
import type { Project, ProjectInvitation } from '../types';

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  invitations: ProjectInvitation[];
  loading: boolean;
  switchProject: (project: Project) => void;
  createProject: (data: { name: string; slug: string; description?: string; is_private?: number; default_repo?: string; auto_repo?: boolean }) => Promise<Project & { autoRepoCreated?: boolean; autoRepoWebUrl?: string; autoRepoError?: string }>;
  updateProject: (id: number, data: Partial<Pick<Project, 'name' | 'description' | 'is_private' | 'default_repo' | 'cursors_enabled' | 'presence_enabled' | 'presence_max_visible'>>) => Promise<Project>;
  deleteProject: (id: number) => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshInvitations: () => Promise<void>;
  acceptInvitation: (token: string) => Promise<void>;
  rejectInvitation: (token: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  currentProject: null,
  invitations: [],
  loading: true,
  switchProject: () => {},
  createProject: async () => ({ id: 0, name: '', description: '', slug: '', owner_id: 0, is_private: 1, default_repo: '', setup_completed: 0, cursors_enabled: 1, presence_enabled: 1, presence_max_visible: 5, cf_site_url: null, role: 'owner', created_at: '', updated_at: '' }),
  updateProject: async () => ({ id: 0, name: '', description: '', slug: '', owner_id: 0, is_private: 1, default_repo: '', setup_completed: 0, cursors_enabled: 1, presence_enabled: 1, presence_max_visible: 5, cf_site_url: null, role: 'owner', created_at: '', updated_at: '' }),
  deleteProject: async () => {},
  refreshProjects: async () => {},
  refreshInvitations: async () => {},
  acceptInvitation: async () => {},
  rejectInvitation: async () => {},
});

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { on, off } = useSocket();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const prevUserIdRef = useRef<number | null>(null);

  const refreshProjectsInternal = useCallback(async (): Promise<Project[]> => {
    try {
      const list = await projectsApi.getProjects();
      setProjects(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  const refreshProjects = useCallback(async (): Promise<void> => {
    await refreshProjectsInternal();
  }, [refreshProjectsInternal]);

  const refreshInvitations = useCallback(async () => {
    try {
      const list = await projectsApi.getMyInvitations();
      setInvitations(list);
    } catch {
      setInvitations([]);
    }
  }, []);

  // Load projects when user changes (login/logout/switch account)
  useEffect(() => {
    const userId = user?.id ?? null;

    // User logged out — clear state
    if (!userId) {
      prevUserIdRef.current = null;
      setProjects([]);
      setCurrentProject(null);
      setInvitations([]);
      setLoading(false);
      return;
    }

    // Same user, already loaded — skip
    if (userId === prevUserIdRef.current) return;
    prevUserIdRef.current = userId;

    setLoading(true);
    (async () => {
      let list = await refreshProjectsInternal();
      await refreshInvitations();

      // Auto-create a default project if user has none
      if (list.length === 0) {
        try {
          const project = await projectsApi.createProject({
            name: 'Mon projet',
            slug: `projet-${userId}`,
            is_private: 1,
          });
          list = [project];
          setProjects(list);
        } catch {
          // ignore — user will see empty state
        }
      }

      // Restore last used project
      const savedId = localStorage.getItem('crab-current-project');
      const saved = savedId ? list.find((p: Project) => p.id === Number(savedId)) : null;
      if (saved) {
        setCurrentProject(saved);
      } else if (list.length > 0) {
        setCurrentProject(list[0]);
        localStorage.setItem('crab-current-project', String(list[0].id));
      }
      setLoading(false);
    })();
  }, [user?.id, refreshProjectsInternal, refreshInvitations]);

  // Listen for real-time project updates from other users
  useEffect(() => {
    on('project:updated', (data: { projectId: number; [key: string]: any }) => {
      const { projectId, ...fields } = data;
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...fields } : p));
      setCurrentProject(prev => prev && prev.id === projectId ? { ...prev, ...fields } : prev);
    });
    return () => { off('project:updated'); };
  }, [on, off]);

  const switchProject = useCallback((project: Project) => {
    setCurrentProject(project);
    localStorage.setItem('crab-current-project', String(project.id));
  }, []);

  const createProjectFn = useCallback(async (data: { name: string; slug: string; description?: string; is_private?: number; default_repo?: string; auto_repo?: boolean }) => {
    const result = await projectsApi.createProject(data);
    setProjects(prev => [result, ...prev]);
    switchProject(result);
    return result;
  }, [switchProject]);

  const updateProjectFn = useCallback(async (id: number, data: Partial<Pick<Project, 'name' | 'description' | 'is_private' | 'default_repo' | 'cursors_enabled' | 'presence_enabled' | 'presence_max_visible'>>) => {
    const updated = await projectsApi.updateProject(id, data);
    setProjects(prev => prev.map(p => p.id === id ? updated : p));
    if (currentProject?.id === id) setCurrentProject(updated);
    return updated;
  }, [currentProject]);

  const deleteProjectFn = useCallback(async (id: number) => {
    await projectsApi.deleteProject(id);
    setProjects(prev => {
      const remaining = prev.filter(p => p.id !== id);
      if (currentProject?.id === id) {
        const next = remaining[0] || null;
        setCurrentProject(next);
        if (next) localStorage.setItem('crab-current-project', String(next.id));
        else localStorage.removeItem('crab-current-project');
      }
      return remaining;
    });
  }, [currentProject]);

  const acceptInvitationFn = useCallback(async (token: string) => {
    await projectsApi.acceptInvitation(token);
    setInvitations(prev => prev.filter(i => i.token !== token));
    await refreshProjects();
  }, [refreshProjects]);

  const rejectInvitationFn = useCallback(async (token: string) => {
    await projectsApi.rejectInvitation(token);
    setInvitations(prev => prev.filter(i => i.token !== token));
  }, []);

  return (
    <ProjectContext.Provider value={{
      projects,
      currentProject,
      invitations,
      loading,
      switchProject,
      createProject: createProjectFn,
      updateProject: updateProjectFn,
      deleteProject: deleteProjectFn,
      refreshProjects,
      refreshInvitations,
      acceptInvitation: acceptInvitationFn,
      rejectInvitation: rejectInvitationFn,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
