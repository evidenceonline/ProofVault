import { dag4 } from '@stardust-collective/dag4';
import fs from 'fs';

const extractKey = async () => {
  try {
    // Try to load the p12 file with common passwords
    const p12Path = '/home/nodeadmin/euclid-development-environment2/source/p12-files/token-key.p12';
    const passwords = ['password', 'changeit', '123456', 'admin', 'test', ''];
    
    const p12Buffer = fs.readFileSync(p12Path);
    
    for (const pass of passwords) {
      try {
        const account = await dag4.keyStore.importAccount({
          keystore: p12Buffer,
          password: pass
        });
        console.log('Success with password:', pass);
        console.log('Address:', account.address);
        console.log('Public Key:', account.publicKey);
        console.log('Private Key:', account.privateKey);
        return;
      } catch (e) {
        // Try next password
      }
    }
    console.log('Could not decrypt with any common password');
  } catch (error) {
    console.error('Error:', error.message);
  }
};

extractKey();
