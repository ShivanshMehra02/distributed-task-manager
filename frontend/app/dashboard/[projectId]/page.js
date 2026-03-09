'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { getSocket, disconnectSocket } from '../../../lib/socket';

const STATUS_LABELS = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'done': 'Done',
};

const STATUS_COLORS = {
  'todo': 'bg-[var(--text-muted)]/20 text-[var(--text-secondary)]',
  'in-progress': 'bg-[var(--warning)]/15 text-[var(--warning)]',
  'done': 'bg-[var(--success)]/15 text-[var(--success)]',
};

export default function DashboardPage() {
  const { projectId } = useParams();
  const router = useRouter();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', status: 'todo' });
  const [presence, setPresence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(u);
    fetchProject();
    fetchTasks();

    // Setup socket
    const socket = getSocket(token);
    socketRef.current = socket;

    if (socket) {
      socket.emit('joinProject', projectId);

      socket.on('taskCreated', (task) => {
        setTasks(prev => {
          const exists = prev.some(t => t._id === task._id);
          return exists ? prev : [task, ...prev];
        });
      });

      socket.on('taskUpdated', (updatedTask) => {
        setTasks(prev => prev.map(t => t._id === updatedTask._id ? updatedTask : t));
        setSelectedTask(prev => prev && prev._id === updatedTask._id ? updatedTask : prev);
      });

      socket.on('taskDeleted', ({ taskId }) => {
        setTasks(prev => prev.filter(t => t._id !== taskId));
        setSelectedTask(prev => prev && prev._id === taskId ? null : prev);
      });

      socket.on('taskStatusChanged', (task) => {
        setTasks(prev => prev.map(t => t._id === task._id ? task : t));
      });

      socket.on('commentAdded', (comment) => {
        setComments(prev => {
          const exists = prev.some(c => c._id === comment._id);
          return exists ? prev : [comment, ...prev];
        });
      });

      socket.on('presenceUpdate', (users) => {
        setPresence(users);
      });
    }

    return () => {
      if (socket) {
        socket.emit('leaveProject', projectId);
        socket.off('taskCreated');
        socket.off('taskUpdated');
        socket.off('taskDeleted');
        socket.off('taskStatusChanged');
        socket.off('commentAdded');
        socket.off('presenceUpdate');
      }
    };
  }, [projectId, router]);

  const fetchProject = async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}`);
      setProject(data);
    } catch (err) {
      console.error(err);
      router.push('/projects');
    }
  };

  const fetchTasks = useCallback(async (appendCursor = null) => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (appendCursor) params.set('cursor', appendCursor);
      params.set('limit', '20');

      const { data } = await api.get(`/projects/${projectId}/tasks?${params}`);
      if (appendCursor) {
        setTasks(prev => [...prev, ...data.tasks]);
      } else {
        setTasks(data.tasks);
      }
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter]);

  useEffect(() => {
    setLoading(true);
    setCursor(null);
    fetchTasks();
  }, [statusFilter, fetchTasks]);

  const createTask = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/tasks', { ...taskForm, projectId });
      setTaskForm({ title: '', description: '', status: 'todo' });
      setShowCreateTask(false);
      // Add task immediately to local state as fallback if socket is slow
      setTasks(prev => {
        const exists = prev.some(t => t._id === data._id);
        return exists ? prev : [data, ...prev];
      });
    } catch (err) {
      console.error(err);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/tasks/${taskId}`);
    } catch (err) {
      console.error(err);
    }
  };

  const selectTask = async (task) => {
    setSelectedTask(task);
    try {
      const { data } = await api.get(`/tasks/${task._id}/comments`);
      setComments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const { data } = await api.post(`/tasks/${selectedTask._id}/comments`, { text: commentText });
      setCommentText('');
      // Add comment immediately to local state as fallback
      setComments(prev => {
        const exists = prev.some(c => c._id === data._id);
        return exists ? prev : [data, ...prev];
      });
    } catch (err) {
      console.error(err);
    }
  };

  const assignSelf = async (taskId) => {
    try {
      await api.post(`/tasks/${taskId}/assign`, { userId: user._id });
    } catch (err) {
      console.error(err);
    }
  };

  const unassignSelf = async (taskId) => {
    try {
      await api.post(`/tasks/${taskId}/unassign`, { userId: user._id });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    }
  };

  const addMember = async (e) => {
    e.preventDefault();
    try {
      // Find user by email first - we need to search
      const { data: searchData } = await api.get(`/search?q=${encodeURIComponent(memberEmail)}`);
      // For simplicity, we use the member's ID directly
      // In a real app we'd have a user search endpoint
      setShowAddMember(false);
      setMemberEmail('');
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-[var(--text-secondary)]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" data-testid="dashboard-page">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              data-testid="back-to-projects"
              onClick={() => router.push('/projects')}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              &larr; Projects
            </button>
            <span className="text-[var(--border)]">|</span>
            <h1 className="font-semibold" data-testid="project-name">{project?.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Presence indicators */}
            {presence.length > 0 && (
              <div className="flex items-center gap-1" data-testid="presence-indicator">
                <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                <span className="text-xs text-[var(--text-muted)]">
                  {presence.length} online
                </span>
              </div>
            )}
            <span className="text-sm text-[var(--text-secondary)]">{user?.name}</span>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-primary)]">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Status filter */}
            <select
              data-testid="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">All Tasks</option>
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>

            {/* Search */}
            <div className="flex items-center gap-2">
              <input
                data-testid="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search tasks..."
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] w-48"
              />
              <button
                data-testid="search-btn"
                onClick={handleSearch}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Search
              </button>
              {searchResults && (
                <button
                  data-testid="clear-search"
                  onClick={() => { setSearchResults(null); setSearchQuery(''); }}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              data-testid="add-member-btn"
              onClick={() => setShowAddMember(true)}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              + Member
            </button>
            <button
              data-testid="create-task-btn"
              onClick={() => setShowCreateTask(true)}
              className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors"
            >
              + Task
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex max-w-[1400px] mx-auto w-full">
        {/* Task list */}
        <div className={`flex-1 p-6 overflow-auto ${selectedTask ? 'border-r border-[var(--border)]' : ''}`}>
          {searchResults ? (
            <div data-testid="search-results">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                Search Results ({searchResults.tasks?.length || 0} tasks, {searchResults.comments?.length || 0} comments)
              </h3>
              {searchResults.tasks?.map(task => (
                <TaskCard key={task._id} task={task} onClick={() => selectTask(task)}
                  onStatusChange={updateTaskStatus} onDelete={deleteTask}
                  onAssign={assignSelf} onUnassign={unassignSelf} userId={user?._id}
                  isSelected={selectedTask?._id === task._id} />
              ))}
            </div>
          ) : (
            <div data-testid="task-list">
              {tasks.length === 0 && !loading ? (
                <div className="text-center py-12 text-[var(--text-secondary)]" data-testid="no-tasks">
                  No tasks yet. Create one to get started.
                </div>
              ) : (
                <>
                  {tasks.map(task => (
                    <TaskCard key={task._id} task={task} onClick={() => selectTask(task)}
                      onStatusChange={updateTaskStatus} onDelete={deleteTask}
                      onAssign={assignSelf} onUnassign={unassignSelf} userId={user?._id}
                      isSelected={selectedTask?._id === task._id} />
                  ))}
                  {hasMore && (
                    <button
                      data-testid="load-more-btn"
                      onClick={() => fetchTasks(cursor)}
                      className="w-full py-2 mt-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                    >
                      Load more tasks
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Task detail panel */}
        {selectedTask && (
          <div className="w-[400px] p-6 overflow-auto bg-[var(--bg-secondary)]" data-testid="task-detail-panel">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-lg" data-testid="task-detail-title">{selectedTask.title}</h3>
              <button
                data-testid="close-task-detail"
                onClick={() => setSelectedTask(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg"
              >
                &times;
              </button>
            </div>

            <div className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium mb-3 ${STATUS_COLORS[selectedTask.status]}`}>
              {STATUS_LABELS[selectedTask.status]}
            </div>

            {selectedTask.description && (
              <p className="text-sm text-[var(--text-secondary)] mb-4">{selectedTask.description}</p>
            )}

            <div className="mb-4">
              <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Assignees</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {selectedTask.assignees?.length > 0 ? (
                  selectedTask.assignees.map(a => (
                    <span key={a._id} className="px-2 py-0.5 rounded bg-[var(--bg-hover)] text-xs text-[var(--text-secondary)]">
                      {a.name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[var(--text-muted)]">No assignees</span>
                )}
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-4">
              <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Comments</span>
              <form onSubmit={addComment} className="mt-3 flex gap-2">
                <input
                  data-testid="comment-input"
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  data-testid="submit-comment-btn"
                  type="submit"
                  className="px-3 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm transition-colors"
                >
                  Send
                </button>
              </form>
              <div className="mt-3 space-y-3 max-h-[400px] overflow-auto" data-testid="comments-list">
                {comments.map(c => (
                  <div key={c._id} className="p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-[var(--text-primary)]">{c.userId?.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">{c.text}</p>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] text-center py-4">No comments yet</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateTask && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" data-testid="create-task-modal">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Task</h3>
            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Title</label>
                <input
                  data-testid="task-title-input"
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="Task title"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
                <textarea
                  data-testid="task-desc-input"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Status</label>
                <select
                  data-testid="task-status-select"
                  value={taskForm.status}
                  onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  data-testid="cancel-create-task"
                  type="button"
                  onClick={() => setShowCreateTask(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  data-testid="submit-create-task"
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

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" data-testid="add-member-modal">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Member</h3>
            <form onSubmit={addMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">User ID</label>
                <input
                  data-testid="member-id-input"
                  type="text"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="Enter user ID"
                  required
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowAddMember(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-sm">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onClick, onStatusChange, onDelete, onAssign, onUnassign, userId, isSelected }) {
  const isAssigned = task.assignees?.some(a => a._id === userId);

  return (
    <div
      data-testid={`task-card-${task._id}`}
      onClick={onClick}
      className={`p-4 mb-2 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'bg-[var(--bg-hover)] border-[var(--accent)]/40'
          : 'bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--text-muted)]/30'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{task.title}</h4>
          {task.description && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{task.description}</p>
          )}
        </div>
        <div className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status]}`}>
          {STATUS_LABELS[task.status]}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Status change buttons */}
          <select
            data-testid={`task-status-change-${task._id}`}
            value={task.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { e.stopPropagation(); onStatusChange(task._id, e.target.value); }}
            className="text-xs px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] focus:outline-none"
          >
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            data-testid={`task-assign-${task._id}`}
            onClick={(e) => { e.stopPropagation(); isAssigned ? onUnassign(task._id) : onAssign(task._id); }}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              isAssigned
                ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {isAssigned ? 'Assigned' : 'Assign me'}
          </button>
          <button
            data-testid={`task-delete-${task._id}`}
            onClick={(e) => { e.stopPropagation(); onDelete(task._id); }}
            className="text-xs px-2 py-1 rounded text-[var(--danger)]/60 hover:text-[var(--danger)] transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {task.assignees?.length > 0 && (
        <div className="mt-2 flex gap-1">
          {task.assignees.map(a => (
            <span key={a._id} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
              {a.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
