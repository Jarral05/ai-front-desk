// `npm run stop`: stops a copy of this app left running on ports 3000 and 5173.
// Only Node programs are stopped, so another program that happens to use one of these ports is
// left alone and named instead.
import { execFileSync } from 'node:child_process';
import { listeningPids, PORTS } from './ports.js';

if (process.platform !== 'win32') {
  console.log('Press Ctrl+C in the window where the app is running.');
  process.exit(0);
}

const run = (file, args) => execFileSync(file, args, { encoding: 'utf8', windowsHide: true });

// Name, parent and command line of one process. The ID is a number we parsed ourselves, never
// text from outside, so it is safe inside the PowerShell command.
function processInfo(pid) {
  const json = run('powershell', ['-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter 'ProcessId=${Number(pid)}' | Select-Object Name,ParentProcessId,CommandLine | ConvertTo-Json`]);
  return json.trim() ? JSON.parse(json) : null;
}

// All of netstat: "-p TCP" alone would miss the page, which listens on IPv6 (::1).
const pids = listeningPids(run('netstat', ['-ano']), PORTS.map((p) => p.port));
if (pids.length === 0) {
  console.log('Nothing to stop: ports 3000 and 5173 are free.');
  process.exit(0);
}

for (const pid of pids) {
  const info = processInfo(pid);
  if (!info) continue;
  if (info.Name.toLowerCase() !== 'node.exe') {
    console.log(`Left alone: ${info.Name} (process ${pid}) is not this app. Close it yourself if you need the port.`);
    continue;
  }
  // `node --watch` keeps a parent that would wait for file changes; stop it too.
  const parent = processInfo(info.ParentProcessId);
  const target = parent?.CommandLine?.includes('--watch') && parent.CommandLine.includes('server.js')
    ? info.ParentProcessId
    : pid;
  try {
    run('taskkill', ['/PID', String(target), '/T', '/F']);
    console.log(`Stopped process ${target}.`);
  } catch {
    console.log(`Couldn't stop process ${target}. It may have stopped already.`);
  }
}
