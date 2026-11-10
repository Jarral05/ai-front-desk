// One way to call the API. Errors come back as { error, fields } with the server's own words.
export async function postJson(url, body) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: 'No connection. Please check your internet and try again.' };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || 'Something went wrong. Please try again.', fields: data.fields };
  return { ok: true, data };
}
