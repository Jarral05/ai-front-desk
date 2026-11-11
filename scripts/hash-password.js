// Makes the value for OWNER_PASSWORD_HASH. Run it with: npm run hash-password
//
// The password is typed in hidden (nothing shows on screen) and is never saved: only the hash is
// printed, and the hash can't be turned back into the password. Paste the printed line into .env
// on your computer, and into the host's settings when the app goes live.
import { hashPassword } from '../server/lib/passwords.js';

// NIST SP 800-63B (2025): a password that is the only way in must be at least 15 characters.
const MIN_LENGTH = 15;

function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      console.error('Run this in a terminal window, so the password can be typed in hidden.');
      process.exit(1);
    }
    stdout.write(question);
    stdin.setRawMode(true); // each key arrives as it is pressed, and nothing is echoed
    stdin.setEncoding('utf8');
    stdin.resume();

    let typed = '';
    const finish = () => {
      stdin.off('data', onKey);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    };
    function onKey(chunk) {
      for (const key of chunk) {
        if (key === '\r' || key === '\n') {
          finish();
          resolve(typed);
          return;
        }
        if (key === '\u0003') { // Ctrl+C
          finish();
          process.exit(130);
        }
        if (key === '\u007f' || key === '\b') typed = typed.slice(0, -1); // Backspace
        else if (key >= ' ') typed += key;
      }
    }
    stdin.on('data', onKey);
  });
}

const password = await askHidden(`New owner password (at least ${MIN_LENGTH} characters; nothing shows as you type): `);
if ([...password].length < MIN_LENGTH) {
  console.error(`That has ${[...password].length} characters. Use at least ${MIN_LENGTH}: a short sentence is easy to remember.`);
  process.exit(1);
}
if ((await askHidden('Type it again: ')) !== password) {
  console.error("The two don't match. Nothing was made; run it again.");
  process.exit(1);
}

console.log('\nAdd these two lines to .env (use the email you want to sign in with):\n');
console.log('OWNER_EMAIL=you@example.com');
console.log(`OWNER_PASSWORD_HASH=${await hashPassword(password)}`);
console.log('\nKeep the password in your password manager. The hash is safe to paste into settings, but keep it out of Git.');
