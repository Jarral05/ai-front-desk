// The dev helpers: a busy port is noticed, and Windows' netstat lines are read correctly.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { inUse, listeningPids } from '../scripts/ports.js';

test('a port with something listening counts as in use, a free one does not', async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  after(() => server.close());
  const { port } = server.address();
  assert.equal(await inUse(port), true);

  // Listen, note the port, close: nothing is on it any more.
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const freePort = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  assert.equal(await inUse(freePort), false);
});

test("netstat's listening lines give the process IDs on our ports only", () => {
  const sample = [
    'Active Connections',
    '',
    '  Proto  Local Address          Foreign Address        State           PID',
    '  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       15488',
    '  TCP    [::]:3000              [::]:0                 LISTENING       15488',
    '  TCP    [::1]:5173             [::]:0                 LISTENING       9120',
    '  TCP    0.0.0.0:30000          0.0.0.0:0              LISTENING       777',
    '  TCP    127.0.0.1:3000         127.0.0.1:51234        ESTABLISHED     15488',
    '  TCP    0.0.0.0:443            0.0.0.0:0              LISTENING       4',
    '  UDP    0.0.0.0:5173           *:*                                    888',
  ].join('\r\n');
  assert.deepEqual(listeningPids(sample, [3000, 5173]), [15488, 9120]);
  assert.deepEqual(listeningPids('', [3000]), []);
});
