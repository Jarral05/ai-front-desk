// Runs before `npm run dev`, `dev:hospital` and `dev:private` (the "pre" scripts in package.json).
// If an earlier copy is still running, a new one would show the old business's page, so this
// stops with a clear message instead.
import { inUse, PORTS } from './ports.js';

const busy = [];
for (const entry of PORTS) {
  if (await inUse(entry.port)) busy.push(entry);
}

if (busy.length > 0) {
  console.error('');
  console.error('Not started: an earlier copy of the app is still running.');
  for (const { port, what } of busy) console.error(`  Port ${port} (${what}) is already in use.`);
  console.error('');
  console.error('Stop it with:  npm run stop');
  console.error('Then start again. (Ctrl+C in Git Bash sometimes leaves the server running.)');
  console.error('');
  process.exit(1);
}
