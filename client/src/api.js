// One way to call the API. Every answer comes back as { ok, status, data } or
// { ok: false, status, error, fields }, with the server's own words in `error`.
async function answer(sending) {
  let res;
  try {
    res = await sending;
  } catch {
    return { ok: false, status: 0, error: 'No connection. Please check your internet and try again.' };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, error: data.error || 'Something went wrong. Please try again.', fields: data.fields };
  }
  return { ok: true, status: res.status, data };
}

function send(method, url, body) {
  return answer(fetch(url, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  }));
}

export const getJson = (url) => send('GET', url);
export const postJson = (url, body = {}) => send('POST', url, body);
export const putJson = (url, body) => send('PUT', url, body);
export const patchJson = (url, body) => send('PATCH', url, body);
export const deleteJson = (url) => send('DELETE', url);

// Sends the file's raw bytes. Its name goes in a header, encoded so any language's letters survive.
export function uploadPdf(url, file) {
  return answer(fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(file.name) },
    body: file,
  }));
}
