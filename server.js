// Entry file: connect to the database, then start listening.
//
// No top-level await in this file or anything it imports. Hostinger loads the entry
// file with require(), which refuses a module that uses it, and the app never starts.
import { config } from './server/config.js';
import { connectDatabase } from './server/db.js';
import { createApp } from './server/app.js';

console.log('AI Front Desk starting. Connecting to the database...');

connectDatabase()
  .then(() => {
    console.log('Database connected.');
    const server = createApp().listen(config.port, () => {
      // The business's name, so it's clear which profile this copy is showing.
      console.log(`AI Front Desk listening on port ${config.port}, showing ${config.profile.name}`);
    });
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Could not start: port ${config.port} is already in use, probably by an earlier copy of the app. `
          + 'Stop it with "npm run stop", then start again.');
      } else {
        console.error('Could not start:', error.message);
      }
      process.exit(1);
    });
  })
  .catch((error) => {
    // The message names the problem. It doesn't include the database password.
    console.error('Could not start:', error.message);
    process.exit(1);
  });
