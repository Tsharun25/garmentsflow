import { useEffect, useState, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Factory, LogOut, ShieldCheck } from 'lucide-react';
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
interface Identity {
  actor: { id: string; tenantId: string; name: string; admin: boolean };
  csrfToken: string;
}
interface FactoryRecord {
  id: string;
  name: string;
  departments: string[];
}
interface Note {
  id: string;
  department: string;
  body: string;
  created_at: string;
}
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { credentials: 'same-origin', ...init });
  const result = (await response.json()) as {
    success: boolean;
    data: T;
    error?: { message: string };
  };
  if (!response.ok) throw new ApiError(response.status, result.error?.message ?? 'Request failed');
  return result.data;
}
function LiveWorkspace({ back }: { back: () => void }) {
  const client = useQueryClient();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [factoryId, setFactoryId] = useState('');
  const [department, setDepartment] = useState('');
  const identity = useQuery({ queryKey: ['identity'], queryFn: () => api<Identity>('/auth/me') });
  const factories = useQuery({
    queryKey: ['factories'],
    queryFn: () => api<FactoryRecord[]>('/factories'),
    enabled: !!identity.data,
  });
  const factory = factories.data?.find((f) => f.id === factoryId);
  const notes = useQuery({
    queryKey: ['notes', factoryId, department],
    queryFn: () =>
      api<Note[]>(`/factories/${factoryId}/notes?department=${encodeURIComponent(department)}`),
    enabled:
      !!identity.data && !!factory && !!department && factory.departments.includes(department),
  });
  useEffect(() => {
    if (identity.error instanceof ApiError && identity.error.status === 401) {
      client.removeQueries({ queryKey: ['factories'] });
      client.removeQueries({ queryKey: ['notes'] });
      setFactoryId('');
      setDepartment('');
    }
  }, [identity.error, client]);
  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      const value = await api<Identity>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant: data.get('tenant'),
          email: data.get('username'),
          password: data.get('password'),
        }),
      });
      await client.resetQueries({ queryKey: ['factories'] });
      client.removeQueries({ queryKey: ['notes'] });
      setFactoryId('');
      setDepartment('');
      client.setQueryData(['identity'], value);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await api('/auth/logout', {
        method: 'POST',
        headers: { 'X-CSRF-Token': identity.data?.csrfToken ?? '' },
      });
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign-out failed');
    } finally {
      setBusy(false);
    }
  }
  async function addNote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setMessage('');
    try {
      await api(`/factories/${factoryId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': identity.data?.csrfToken ?? '',
        },
        body: JSON.stringify({ department, body: data.get('body') }),
      });
      form.reset();
      await client.invalidateQueries({ queryKey: ['notes', factoryId, department] });
      setMessage('Note saved with an audit event.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save note');
      if (error instanceof ApiError && error.status === 401) {
        client.clear();
        await client.invalidateQueries({ queryKey: ['identity'] });
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="live-shell">
      <div className="live-top">
        <button className="outline" onClick={back}>
          <ArrowLeft size={16} />
          Sample dashboard
        </button>
        <span className="preview-badge">DEVELOPMENT FOUNDATION</span>
      </div>
      <div className="live-heading">
        <Factory size={30} />
        <h1>Factory workspace</h1>
        <p>Named accounts. Scoped access. Traceable work.</p>
      </div>
      <div className="notice">
        <ShieldCheck size={16} />
        <span>
          Internal foundation only. Admin MFA, invitations and production release checks are still
          pending.
        </span>
      </div>
      {identity.isPending ? (
        <p role="status">Checking your session...</p>
      ) : identity.data ? (
        <>
          <div className="live-user">
            <div>
              <strong>{identity.data.actor.name}</strong>
              <small>{identity.data.actor.admin ? 'Customer Main Admin' : 'Scoped employee'}</small>
            </div>
            <button disabled={busy} className="outline" onClick={() => void logout()}>
              <LogOut size={15} />
              Sign out
            </button>
          </div>
          <section className="live-panel">
            <h2>Choose your work scope</h2>
            {factories.isPending ? (
              <p>Loading factories...</p>
            ) : factories.error ? (
              <p role="alert">{factories.error.message}</p>
            ) : factories.data?.length === 0 ? (
              <p>No factory role is assigned. Contact your Main Admin.</p>
            ) : (
              <div className="scope-fields">
                <label>
                  Factory
                  <select
                    aria-label="Factory"
                    value={factoryId}
                    onChange={(e) => {
                      setFactoryId(e.target.value);
                      setDepartment('');
                      setMessage('');
                      client.removeQueries({ queryKey: ['notes'] });
                    }}
                  >
                    <option value="">Select factory</option>
                    {factories.data?.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Department
                  <select
                    aria-label="Department"
                    disabled={!factory}
                    value={department}
                    onChange={(e) => {
                      setDepartment(e.target.value);
                      setMessage('');
                      client.removeQueries({ queryKey: ['notes'] });
                    }}
                  >
                    <option value="">Select department</option>
                    {factory?.departments.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </section>
          {factory && department && (
            <section className="live-panel">
              <h2>
                {factory.name} / {department}
              </h2>
              <p className="muted">
                Work notes are saved in PostgreSQL. They do not post stock or change production
                quantities.
              </p>
              <form onSubmit={(e) => void addNote(e)}>
                <label>
                  New work note
                  <textarea
                    name="body"
                    required
                    maxLength={1000}
                    rows={3}
                    placeholder="Record a non-sensitive departmental work note..."
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Save work note
                </button>
              </form>
              {notes.isPending ? (
                <p>Loading work notes...</p>
              ) : notes.error ? (
                <p role="alert">{notes.error.message}</p>
              ) : notes.data?.length === 0 ? (
                <p className="muted">No notes in this scope yet.</p>
              ) : (
                <ul className="work-notes">
                  {notes.data?.map((n) => (
                    <li key={n.id}>
                      <p>{n.body}</p>
                      <small>{new Date(n.created_at).toLocaleString()}</small>
                    </li>
                  ))}
                </ul>
              )}
              <p className="muted">Shows the latest 50 notes.</p>
            </section>
          )}
        </>
      ) : identity.error instanceof ApiError && identity.error.status === 401 ? (
        <section className="live-panel login-panel">
          <h2>Sign in to your business</h2>
          <p className="muted">Use an account provisioned by your installation owner.</p>
          <form onSubmit={(e) => void signIn(e)}>
            <label>
              Business slug
              <input
                name="tenant"
                required
                pattern="[a-z0-9-]{2,60}"
                autoComplete="organization"
                placeholder="your-business"
              />
            </label>
            <label>
              Email
              <input name="username" type="email" required autoComplete="username" />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                maxLength={128}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>
      ) : (
        <section className="live-panel">
          <h2>Workspace unavailable</h2>
          <p role="alert">
            {identity.error?.message ?? 'Start the configured API and PostgreSQL database.'}
          </p>
          <button className="outline" onClick={() => void identity.refetch()}>
            Try again
          </button>
        </section>
      )}
      {message && (
        <p className="live-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
export function Workspace({ back }: { back: () => void }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LiveWorkspace back={back} />
    </QueryClientProvider>
  );
}
