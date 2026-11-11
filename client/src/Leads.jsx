import { useEffect, useState } from 'react';
import { getJson, patchJson } from './api.js';

const FILTERS = ['All', 'Hot', 'Warm', 'Cold', 'Unscored'];
// Dates in the owner's own language and time zone, as their browser reports them.
const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// The owner's dashboard: the last 7 days' numbers, a score filter, the leads newest first, and the
// CSV download. Every name, message and summary is shown as plain text.
export function Leads({ onSignedOut }) {
  const [filter, setFilter] = useState('All');
  const [leads, setLeads] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const query = filter === 'All' ? '' : `?score=${filter}`;

  useEffect(() => {
    let active = true;
    setLeads(null);
    setError('');
    Promise.all([getJson(`/api/owner/leads${query}`), getJson('/api/owner/stats')]).then(([list, numbers]) => {
      if (!active) return;
      if (list.status === 401 || numbers.status === 401) {
        onSignedOut();
        return;
      }
      if (!list.ok) setError(list.error);
      else setLeads(list.data.leads);
      if (numbers.ok) setStats(numbers.data);
    });
    return () => {
      active = false;
    };
  }, [query]);

  async function setStatus(lead, status) {
    const result = await patchJson(`/api/owner/leads/${lead.id}`, { status });
    if (result.status === 401) {
      onSignedOut();
      return;
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLeads((list) => list.map((item) => (item.id === lead.id ? result.data.lead : item)));
  }

  return (
    <>
      <div className="owner-title">
        <h1>Leads</h1>
        <a className="button" href={`/api/owner/leads.csv${query}`} download>Download CSV</a>
      </div>

      {stats && (
        <>
          <dl className="stats">
            <div><dt>Chats</dt><dd>{stats.chats}</dd></div>
            <div><dt>Leads</dt><dd>{stats.leads}</dd></div>
            <div><dt>Hot leads</dt><dd>{stats.hot}</dd></div>
          </dl>
          <p className="quiet stats-note">The last {stats.days} days.</p>
        </>
      )}

      <div className="filters" role="group" aria-label="Show leads by score">
        {FILTERS.map((name) => (
          <button key={name} type="button" className="chip" aria-pressed={filter === name} onClick={() => setFilter(name)}>
            {name}
          </button>
        ))}
      </div>

      {error && <p className="notice" role="alert">{error}</p>}
      {!leads && !error && <p className="quiet">Loading…</p>}
      {leads?.length === 0 && (
        <p className="owner-card quiet">
          No {filter === 'All' ? '' : `${filter} `}leads yet. In this demo, leads delete themselves after 24 hours.
        </p>
      )}

      <ul className="lead-list">
        {leads?.map((lead) => (
          <li key={lead.id} className="owner-card lead">
            <div className="lead-top">
              <h2>{lead.name}</h2>
              <span className={`badge badge-${lead.score.toLowerCase()}`}>{lead.score}</span>
            </div>
            <p className="quiet lead-meta">
              {when.format(new Date(lead.receivedAt))} · {lead.service} · {lead.timing}
            </p>
            {lead.summary
              ? <p>{lead.summary}</p>
              : <p className="quiet">No AI summary: the AI wasn't available when this lead came in.</p>}
            {lead.scoreReasons.length > 0 && (
              <ul className="reasons" aria-label="Why this score">
                {lead.scoreReasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            )}
            {lead.message && <p><span className="quiet">Their message: </span>{lead.message}</p>}
            <p>
              <a href={`mailto:${lead.email}`}>{lead.email}</a>
              {lead.phone && <> · {lead.phone}</>}
            </p>
            <div className="lead-actions">
              <span className={`status status-${lead.status.toLowerCase()}`}>{lead.status}</span>
              <button type="button" className="button-quiet" onClick={() => setStatus(lead, lead.status === 'New' ? 'Contacted' : 'New')}>
                {lead.status === 'New' ? 'Mark as contacted' : 'Mark as new'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
