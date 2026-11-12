import { useEffect, useState } from 'react';
import { deleteJson, getJson, patchJson, postJson } from './api.js';
import { LeadCard } from './LeadCard.jsx';

const FILTERS = ['All', 'Hot', 'Warm', 'Cold', 'Unscored'];
const CHANNEL_NAMES = { email: 'Email', sheet: 'Sheet' };
const STATUS_WORDS = { sent: 'sent', pending: 'sending…', failed: 'Not sent' };

// How the lead reached the owner: "Email: sent · Sheet: Not sent [Retry]". Hidden when neither
// is set up, and for sample leads, which are never sent anywhere.
function Delivery({ lead, busy, onRetry }) {
  const shown = Object.entries(lead.notify ?? {}).filter(([, status]) => status !== 'off');
  if (lead.sample || shown.length === 0) return null;
  return (
    <p className="delivery">
      {shown.map(([channel, status]) => (
        <span key={channel} className={`delivery-item delivery-${status}`}>
          {CHANNEL_NAMES[channel]}: {STATUS_WORDS[status]}
          {status === 'failed' && (
            <button type="button" className="button-quiet retry" disabled={busy === `${lead.id}:${channel}`}
              onClick={() => onRetry(lead, channel)} aria-label={`Retry ${CHANNEL_NAMES[channel].toLowerCase()} for ${lead.name}`}>
              {busy === `${lead.id}:${channel}` ? 'Retrying…' : 'Retry'}
            </button>
          )}
        </span>
      ))}
    </p>
  );
}

// The owner's dashboard: the last 7 days' numbers, a score filter, the leads newest first, and the
// CSV download. Every name, message and summary is shown as plain text.
export function Leads({ onSignedOut }) {
  const [filter, setFilter] = useState('All');
  const [leads, setLeads] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [samples, setSamples] = useState({ available: false, busy: false });
  // Bumped after sample leads are added or removed, so the list loads again.
  const [reload, setReload] = useState(0);
  // Which lead and channel is being retried, for example "6731…:sheet".
  const [retrying, setRetrying] = useState('');
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
      else {
        setLeads(list.data.leads);
        setSamples((s) => ({ ...s, available: list.data.samplesAvailable }));
      }
      if (numbers.ok) setStats(numbers.data);
    });
    return () => {
      active = false;
    };
  }, [query, reload]);

  async function changeSamples(add) {
    setSamples((s) => ({ ...s, busy: true }));
    const result = add ? await postJson('/api/owner/sample-leads') : await deleteJson('/api/owner/sample-leads');
    setSamples((s) => ({ ...s, busy: false }));
    if (result.status === 401) {
      onSignedOut();
      return;
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReload((n) => n + 1);
  }

  const hasSamples = leads?.some((lead) => lead.sample);

  async function retry(lead, channel) {
    setRetrying(`${lead.id}:${channel}`);
    const result = await postJson(`/api/owner/leads/${lead.id}/notify`, { channel });
    setRetrying('');
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
        <div className="owner-actions">
          {samples.available && (
            <button type="button" className="button-quiet" disabled={samples.busy} onClick={() => changeSamples(!hasSamples)}>
              {hasSamples ? 'Remove sample leads' : 'Fill with sample leads'}
            </button>
          )}
          <a className="button" href={`/api/owner/leads.csv${query}`} download>Download CSV</a>
        </div>
      </div>

      {stats && (
        <>
          <dl className="stats">
            <div><dt>Chats</dt><dd>{stats.chats}</dd></div>
            <div><dt>Leads</dt><dd>{stats.leads + stats.samples.leads}</dd></div>
            <div><dt>Hot leads</dt><dd>{stats.hot + stats.samples.hot}</dd></div>
          </dl>
          <p className="quiet stats-note">
            The last {stats.days} days.
            {stats.samples.leads > 0 && ` Includes ${stats.samples.leads} sample leads.`}
          </p>
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
          <LeadCard key={lead.id} lead={lead} tag={lead.sample ? 'Sample' : null}>
            <Delivery lead={lead} busy={retrying} onRetry={retry} />
            <div className="lead-actions">
              <span className={`status status-${lead.status.toLowerCase()}`}>{lead.status}</span>
              <button type="button" className="button-quiet" onClick={() => setStatus(lead, lead.status === 'New' ? 'Contacted' : 'New')}>
                {lead.status === 'New' ? 'Mark as contacted' : 'Mark as new'}
              </button>
            </div>
          </LeadCard>
        ))}
      </ul>
    </>
  );
}
