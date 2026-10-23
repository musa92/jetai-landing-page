// Prints the gate hash for a new demo password. Paste it into PW_HASH in js/app.js.
// Usage: node scripts/set-password.mjs "new password"
import { createHash } from 'node:crypto';
const pw = process.argv[2];
if (!pw) { console.error('usage: node scripts/set-password.mjs "<password>"'); process.exit(1); }
console.log(createHash('sha256').update('custodian:' + pw).digest('hex'));
