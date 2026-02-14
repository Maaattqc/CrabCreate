import axios from 'axios';
import * as repoDb from '../db/repositories';

export interface GitProvider {
  validateToken(): Promise<boolean>;
  createRepo(name: string, isPrivate: boolean): Promise<{ cloneUrl: string; webUrl: string }>;
  createPR(branch: string, target: string, title: string, body: string): Promise<{ id: number; url: string }>;
  mergePR(prId: number, strategy: string): Promise<void>;
  declinePR(prId: number): Promise<void>;
}

// ── GitHub ──────────────────────────────────────────────────────────────────

class GitHubProvider implements GitProvider {
  private token: string;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
    };
  }

  async validateToken(): Promise<boolean> {
    try {
      const res = await axios.get('https://api.github.com/user', { headers: this.headers() });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  async createRepo(name: string, isPrivate: boolean): Promise<{ cloneUrl: string; webUrl: string }> {
    // Try org repo first, fallback to user repo
    let res;
    try {
      res = await axios.post(`https://api.github.com/orgs/${this.owner}/repos`, {
        name,
        private: isPrivate,
        auto_init: true,
      }, { headers: this.headers() });
    } catch {
      res = await axios.post('https://api.github.com/user/repos', {
        name,
        private: isPrivate,
        auto_init: true,
      }, { headers: this.headers() });
    }
    return {
      cloneUrl: res.data.clone_url,
      webUrl: res.data.html_url,
    };
  }

  async createPR(branch: string, target: string, title: string, body: string): Promise<{ id: number; url: string }> {
    const res = await axios.post(
      `https://api.github.com/repos/${this.owner}/${this.repo}/pulls`,
      { title, body, head: branch, base: target },
      { headers: this.headers() },
    );
    return { id: res.data.number, url: res.data.html_url };
  }

  async mergePR(prId: number, strategy: string): Promise<void> {
    const mergeMethod = strategy === 'squash' ? 'squash' : strategy === 'fast_forward' ? 'rebase' : 'merge';
    await axios.put(
      `https://api.github.com/repos/${this.owner}/${this.repo}/pulls/${prId}/merge`,
      { merge_method: mergeMethod },
      { headers: this.headers() },
    );
  }

  async declinePR(prId: number): Promise<void> {
    await axios.patch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/pulls/${prId}`,
      { state: 'closed' },
      { headers: this.headers() },
    );
  }
}

// ── GitLab ──────────────────────────────────────────────────────────────────

class GitLabProvider implements GitProvider {
  private token: string;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  private headers() {
    return { 'PRIVATE-TOKEN': this.token };
  }

  private projectPath() {
    return encodeURIComponent(`${this.owner}/${this.repo}`);
  }

  async validateToken(): Promise<boolean> {
    try {
      const res = await axios.get('https://gitlab.com/api/v4/user', { headers: this.headers() });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  async createRepo(name: string, isPrivate: boolean): Promise<{ cloneUrl: string; webUrl: string }> {
    const res = await axios.post('https://gitlab.com/api/v4/projects', {
      name,
      visibility: isPrivate ? 'private' : 'public',
      initialize_with_readme: true,
      namespace_id: undefined, // uses user's namespace by default
    }, { headers: this.headers() });
    return {
      cloneUrl: res.data.http_url_to_repo,
      webUrl: res.data.web_url,
    };
  }

  async createPR(branch: string, target: string, title: string, body: string): Promise<{ id: number; url: string }> {
    const res = await axios.post(
      `https://gitlab.com/api/v4/projects/${this.projectPath()}/merge_requests`,
      { source_branch: branch, target_branch: target, title, description: body },
      { headers: this.headers() },
    );
    return { id: res.data.iid, url: res.data.web_url };
  }

  async mergePR(prId: number, strategy: string): Promise<void> {
    const squash = strategy === 'squash';
    await axios.put(
      `https://gitlab.com/api/v4/projects/${this.projectPath()}/merge_requests/${prId}/merge`,
      { squash },
      { headers: this.headers() },
    );
  }

  async declinePR(prId: number): Promise<void> {
    await axios.put(
      `https://gitlab.com/api/v4/projects/${this.projectPath()}/merge_requests/${prId}`,
      { state_event: 'close' },
      { headers: this.headers() },
    );
  }
}

// ── Bitbucket ───────────────────────────────────────────────────────────────

class BitbucketProvider implements GitProvider {
  private token: string;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  private auth() {
    // Bitbucket uses username:app_password — owner is the username, token is app password
    return { username: this.owner, password: this.token };
  }

  async validateToken(): Promise<boolean> {
    try {
      const res = await axios.get('https://api.bitbucket.org/2.0/user', { auth: this.auth() });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  async createRepo(name: string, isPrivate: boolean): Promise<{ cloneUrl: string; webUrl: string }> {
    const res = await axios.post(
      `https://api.bitbucket.org/2.0/repositories/${this.owner}/${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`,
      { scm: 'git', is_private: isPrivate, name },
      { auth: this.auth() },
    );
    const cloneLink = res.data.links?.clone?.find((l: { name: string; href: string }) => l.name === 'https');
    return {
      cloneUrl: cloneLink?.href || '',
      webUrl: res.data.links?.html?.href || '',
    };
  }

  async createPR(branch: string, target: string, title: string, body: string): Promise<{ id: number; url: string }> {
    const closeBranch = (repoDb.getConfig('git_pr_close_source_branch') || '1') === '1';
    const res = await axios.post(
      `https://api.bitbucket.org/2.0/repositories/${this.owner}/${this.repo}/pullrequests`,
      {
        title,
        description: body,
        source: { branch: { name: branch } },
        destination: { branch: { name: target } },
        close_source_branch: closeBranch,
      },
      { auth: this.auth() },
    );
    return {
      id: res.data.id,
      url: res.data.links?.html?.href || '',
    };
  }

  async mergePR(prId: number, strategy: string): Promise<void> {
    await axios.post(
      `https://api.bitbucket.org/2.0/repositories/${this.owner}/${this.repo}/pullrequests/${prId}/merge`,
      { merge_strategy: strategy },
      { auth: this.auth() },
    );
  }

  async declinePR(prId: number): Promise<void> {
    await axios.post(
      `https://api.bitbucket.org/2.0/repositories/${this.owner}/${this.repo}/pullrequests/${prId}/decline`,
      {},
      { auth: this.auth() },
    );
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createGitProvider(provider: string, token: string, owner: string, repo: string): GitProvider {
  switch (provider) {
    case 'github':
      return new GitHubProvider(token, owner, repo);
    case 'gitlab':
      return new GitLabProvider(token, owner, repo);
    case 'bitbucket':
      return new BitbucketProvider(token, owner, repo);
    default:
      throw new Error(`Unknown git provider: ${provider}`);
  }
}

/**
 * Build authenticated clone URL for a given provider.
 */
export function buildCloneUrl(provider: string, token: string, owner: string, repo: string): string {
  switch (provider) {
    case 'github':
      return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
    case 'gitlab':
      return `https://oauth2:${token}@gitlab.com/${owner}/${repo}.git`;
    case 'bitbucket':
      return `https://${owner}:${token}@bitbucket.org/${owner}/${repo}.git`;
    default:
      throw new Error(`Unknown git provider: ${provider}`);
  }
}
