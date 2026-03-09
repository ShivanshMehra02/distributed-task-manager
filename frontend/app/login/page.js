'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = isRegister ? form : { email: form.email, password: form.password };
      const { data } = await api.post(endpoint, payload);

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/projects');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="login-title">
            Task Manager
          </h1>
          <p className="mt-2 text-[var(--text-secondary)] text-sm">
            Real-time collaborative task management
          </p>
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-8">
          <h2 className="text-xl font-semibold mb-6" data-testid="auth-heading">
            {isRegister ? 'Create Account' : 'Sign In'}
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-sm" data-testid="auth-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Name</label>
                <input
                  data-testid="name-input"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="Your name"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Email</label>
              <input
                data-testid="email-input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Password</label>
              <input
                data-testid="password-input"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                placeholder="Min 6 characters"
                required
                minLength={6}
              />
            </div>

            <button
              data-testid="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              data-testid="toggle-auth-mode"
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
            >
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
