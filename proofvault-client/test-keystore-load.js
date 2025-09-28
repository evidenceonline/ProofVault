import { dag4 } from '@stardust-collective/dag4';
import fs from 'fs';

// Test loading the keystore with the correct method
const p12Path = '/home/nodeadmin/euclid-development-environment2/source/p12-files/token-key.p12';
const p12Buffer = fs.readFileSync(p12Path);

try {
  // The correct method is dag4.keyStore.importKeyStore
  const keyStore = await dag4.keyStore.importKeyStore(p12Buffer, 'password');
  console.log('Success\! Loaded keystore');
  console.log('Address:', keyStore.address);
  
  // Create account from the keystore
  const account = dag4.createAccount(keyStore.privateKey);
  console.log('Account address:', account.address);
  console.log('Private key:', account.keyTrio.privateKey);
} catch (e) {
  console.error('Failed:', e.message);
}
