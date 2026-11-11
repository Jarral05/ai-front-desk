import { useState } from 'react';
import { postJson } from './api.js';

// The owner's sign-in form. The browser's password manager can fill it: the autocomplete names
// below are the ones password managers look for.
export function OwnerLogin({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setError('');
    const result = await postJson('/api/owner/login', { email, password });
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPassword('');
    onSignedIn(result.data.email);
  }

  return (
    <section className="owner-card owner-login" aria-labelledby="login-title">
      <h1 id="login-title">Owner sign-in</h1>
      <p className="quiet">
        For the clinic owner only. Visitors don't need an account: they use the chat on the clinic page.
      </p>
      <form className="stack" onSubmit={submit}>
        <label>Email
          <input type="email" autoComplete="username" value={email} maxLength={120} required
            onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>Password
          <input type="password" autoComplete="current-password" value={password} maxLength={200} required
            onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button" disabled={sending}>{sending ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </section>
  );
}
