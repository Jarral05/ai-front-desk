// The two ports `npm run dev` uses, and how to tell whether something already holds them.
// Shared by scripts/check-ports.js (runs before every dev command) and scripts/stop.js.
import net from 'node:net';

export const PORTS = Object.freeze([
  { port: 3000, what: 'the server (api)' },
  { port: 5173, what: 'the page (web)' },
]);

// True if something answers on this port. A test connection is used rather than trying to
// listen: Vite may listen on ::1 only and Node on ::, and a listen test can miss one of them.
function answers(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(800, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

export async function inUse(port) {
  const results = await Promise.all(['127.0.0.1', '::1'].map((host) => answers(port, host)));
  return results.some(Boolean);
}

// Windows' `netstat -ano` lines, for example
//   TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    15488
//   TCP    [::1]:5173      [::]:0       LISTENING    9120
// → the process IDs listening on the given ports.
export function listeningPids(netstatText, ports) {
  const pids = new Set();
  for (const line of netstatText.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5 || parts[0] !== 'TCP' || parts[3] !== 'LISTENING') continue;
    const port = Number(parts[1].slice(parts[1].lastIndexOf(':') + 1));
    const pid = Number(parts[4]);
    if (ports.includes(port) && Number.isInteger(pid) && pid > 0) pids.add(pid);
  }
  return [...pids];
}
