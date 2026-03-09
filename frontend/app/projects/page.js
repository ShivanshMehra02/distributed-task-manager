'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(u);
    fetchProjects();
  }, [router]);

  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/projects');
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (e) => {
    e.preventDefault();
    try {
      await api.post('/projects', form);
      setForm({ name: '', description: '' });
      setShowCreate(false);
      fetchProjects();
    } catch (err) {
      console.error(err);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div className="min-h-screen" data-testid="projects-page">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Task Manager</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--text-secondary)]" data-testid="user-name">
              {user?.name}
            </span>
            <button
              data-testid="logout-btn"
              onClick={logout}
              className="text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Projects</h2>
          <button
            data-testid="create-project-btn"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors"
          >
            + New Project
          </button>
        </div>

        {/* Create Project Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" data-testid="create-project-modal">
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Create Project</h3>
              <form onSubmit={createProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Name</label>
                  <input
                    data-testid="project-name-input"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                    placeholder="Project name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
                  <textarea
                    data-testid="project-desc-input"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    data-testid="cancel-create-project"
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    data-testid="submit-create-project"
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {loading ? (
          <div className="text-[var(--text-secondary)] text-center py-16">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16" data-testid="no-projects">
            <p className="text-[var(--text-secondary)] mb-4">No projects yet</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-[var(--accent)] hover:text-[var(--accent-hover)] text-sm transition-colors"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="projects-grid">
            {projects.map((project) => (
              <div
                key={project._id}
                data-testid={`project-card-${project._id}`}
                onClick={() => router.push(`/dashboard/${project._id}`)}
                className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 cursor-pointer hover:border-[var(--accent)]/40 transition-all group"
              >
                <h3 className="font-semibold text-base group-hover:text-[var(--accent)] transition-colors">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-sm text-[var(--text-secondary)] mt-1.5 line-clamp-2">
                    {project.description}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>{project.members?.length || 0} member{project.members?.length !== 1 ? 's' : ''}</span>
                  <span>&middot;</span>
                  <span>by {project.owner?.name || 'Unknown'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
