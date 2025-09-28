import { dag4 } from '@stardust-collective/dag4';
import fs from 'fs';

// Try different methods to import keystore
const p12Path = '/home/nodeadmin/euclid-development-environment2/source/p12-files/token-key.p12';
const p12Buffer = fs.readFileSync(p12Path);

console.log('Attempting to load keystore...');

// Method 1: Try with dag4.keyStore directly
try {
  const privateKey = dag4.keyStore.getPrivateKeyFromKeyStore(p12Buffer, 'password');
  if (privateKey) {
    console.log('✅ Success\! Got private key from keystore');
    const account = dag4.createAccount(privateKey);
    console.log('Address:', account.address);
    console.log('Private key length:', privateKey.length);
  }
} catch (e) {
  console.log('Method 1 failed:', e.message);
}

// Method 2: Try loadKeyStore
try {
  const result = dag4.keyStore.loadKeyStore(p12Buffer, 'password');
  console.log('Method 2 result:', result);
} catch (e) {
  console.log('Method 2 failed:', e.message);
}

// Method 3: Try parseKeyStore
try {
  const result = dag4.keyStore.parseKeyStore(p12Buffer, 'password');
  console.log('Method 3 result:', result);
} catch (e) {
  console.log('Method 3 failed:', e.message);
}
