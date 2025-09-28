// ping.js
import { dag4 } from '@stardust-collective/dag4';
import fetch from 'node-fetch';

(async () => {
  // dag4 is mainly useful for wallet + L0/L1 interaction.
  // We'll just use it to confirm the L1 is reachable.
  try {
    const info = await (await fetch('http://localhost:9400/node/info')).json();
    console.log('Data L1 up:', info);
  } catch (e) {
    console.error('Cannot reach Data L1:', e.message);
  }
})();
