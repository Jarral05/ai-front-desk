import { useEffect, useState } from 'react';
import { getJson } from './api.js';
import { applyBrand, Logo } from './brand.jsx';
import { LeadCard } from './LeadCard.jsx';

// "See what the owner sees": the visitor's own booking exactly as the owner's dashboard shows it,
// next to example leads. The server finds the booking from an HttpOnly cookie set when the form was
// sent; there is no lead ID in the address, so nobody can look at anyone else's.
export default function MyLead() {
  const [clinic, setClinic] = useState(null);
  const [view, setView] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getJson('/api/clinic').then((result) => {
      if (!result.ok) return;
      setClinic(result.data);
      applyBrand(result.data.brand);
      document.title = `What the owner sees · ${result.data.name}`;
    });
    getJson('/api/my-lead').then((result) => (result.ok ? setView(result.data) : setError(result.error)));
  }, []);

  const place = clinic?.place ?? 'clinic';

  return (
    <>
      <div className="demo-bar" role="note">
        {clinic?.demoNote ?? 'Demo website. Please don\'t enter real personal details.'}
      </div>
      <header className="site-header">
        <div className="wrap">
          <span className="logo"><Logo clinic={clinic} />{clinic?.name ?? ''}</span>
        </div>
      </header>

      <main className="wrap owner-main">
        <h1>What the owner sees</h1>
        <p className="lead-intro">
          This is your booking exactly as the {place}'s owner sees it on their dashboard: with an AI
          summary, a score and the reasons for it. It also reached them by email and as a row in their
          Google Sheet, if those are switched on. The examples below are made up.
        </p>

        {error && <p className="notice" role="alert">{error}</p>}
        {!view && !error && <p className="quiet">Loading…</p>}
        {view && (
          <ul className="lead-list">
            <LeadCard lead={view.lead} tag="Your booking" highlight />
            {view.examples.map((lead) => <LeadCard key={lead.id} lead={lead} tag="Example" />)}
          </ul>
        )}
      </main>

      <footer className="site-footer">
        <div className="wrap"><a href="/">Back to the {place} page</a></div>
      </footer>
    </>
  );
}
