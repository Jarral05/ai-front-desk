import { useEffect, useState } from 'react';
import { getJson, postJson } from './api.js';
import { Knowledge } from './Knowledge.jsx';
import { Leads } from './Leads.jsx';
import { OwnerLogin } from './OwnerLogin.jsx';

const pageFromAddress = () => (window.location.pathname.startsWith('/owner/knowledge') ? 'knowledge' : 'leads');

// The owner's side: sign-in, then the Leads and Knowledge pages. The server checks the sign-in on
// every request; this page only decides what to show. If any answer says "Please sign in" (the
// session ran out), the sign-in form comes back.
export default function Owner() {
  const [email, setEmail] = useState(null);
  const [checked, setChecked] = useState(false);
  const [page, setPage] = useState(pageFromAddress);

  useEffect(() => {
    document.title = 'Owner dashboard · Maple Lane Physio (Demo)';
    getJson('/api/owner/session').then((result) => {
      setEmail(result.ok && result.data.signedIn ? result.data.email : null);
      setChecked(true);
    });
    // The browser's Back button changes the address; follow it.
    const onBack = () => setPage(pageFromAddress());
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);

  const go = (next) => (event) => {
    event.preventDefault();
    window.history.pushState(null, '', next === 'knowledge' ? '/owner/knowledge' : '/owner');
    setPage(next);
  };

  async function signOut() {
    await postJson('/api/owner/logout');
    setEmail(null);
  }

  const signedOut = () => setEmail(null);

  return (
    <>
      <div className="demo-bar" role="note">
        Owner dashboard of a demo clinic. Leads here are made up and delete themselves after 24 hours.
      </div>
      <header className="site-header">
        <div className="wrap owner-head">
          <span className="logo">Maple Lane Physio (Demo) · Owner</span>
          {email && (
            <nav className="owner-nav" aria-label="Owner pages">
              <a href="/owner" aria-current={page === 'leads' ? 'page' : undefined} onClick={go('leads')}>Leads</a>
              <a href="/owner/knowledge" aria-current={page === 'knowledge' ? 'page' : undefined} onClick={go('knowledge')}>Knowledge</a>
              <button type="button" className="owner-signout" onClick={signOut}>Sign out</button>
            </nav>
          )}
        </div>
      </header>

      <main className="wrap owner-main">
        {!checked && <p className="quiet">Loading…</p>}
        {checked && !email && <OwnerLogin onSignedIn={setEmail} />}
        {checked && email && page === 'leads' && <Leads onSignedOut={signedOut} />}
        {checked && email && page === 'knowledge' && <Knowledge onSignedOut={signedOut} />}
      </main>

      <footer className="site-footer">
        <div className="wrap"><a href="/">Back to the clinic page</a></div>
      </footer>
    </>
  );
}
