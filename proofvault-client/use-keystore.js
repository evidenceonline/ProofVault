import { dag4 } from '@stardust-collective/dag4';
import fs from 'fs';
import fetch from 'node-fetch';

const DATA_L1_URL = 'http://localhost:9400';

const signAndSubmit = async () => {
  try {
    // Read the text-update payload
    const textUpdate = JSON.parse(fs.readFileSync('./text-update.json', 'utf8'));
    console.log('TextUpdate to submit:', textUpdate);
    
    // Load the p12 keystore
    const p12Path = '/home/nodeadmin/euclid-development-environment2/source/p12-files/token-key.p12';
    const p12Buffer = fs.readFileSync(p12Path);
    
    // Import account from keystore - dag4.js uses loadKeyStore
    let account;
    try {
      // Try with empty password first
      account = dag4.account.loadKeyStore(p12Buffer, '');
      console.log('Loaded keystore successfully');
    } catch (e) {
      console.log('Trying with different password...');
      // The keystore might use the standard 'password'
      try {
        account = dag4.account.loadKeyStore(p12Buffer, 'password');
      } catch (e2) {
        // Try one more common option
        try {
          account = dag4.account.loadKeyStore(p12Buffer, Buffer.from(''));
        } catch (e3) {
          console.error('Could not decrypt keystore');
          return;
        }
      }
    }
    
    console.log('Using address:', account.address);
    console.log('Public key:', account.keyTrio.publicKey);
    
    // Generate the signature using the account's private key
    const encodedMessage = Buffer.from(JSON.stringify(textUpdate)).toString('base64');
    const signature = await dag4.keyStore.dataSign(
      account.keyTrio.privateKey, 
      encodedMessage
    );
    
    const publicKey = account.keyTrio.publicKey;
    const uncompressedPublicKey = publicKey.length === 128 ? '04' + publicKey : publicKey;
    
    const proof = {
      id: uncompressedPublicKey.substring(2),
      signature
    };
    
    // Create the signed message body
    const body = {
      value: textUpdate,
      proofs: [proof]
    };
    
    console.log('\nSigned message:');
    console.log(JSON.stringify(body, null, 2));
    
    // Submit to Data L1
    console.log('\nSubmitting to Data L1 /data endpoint...');
    const response = await fetch(`${DATA_L1_URL}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const responseText = await response.text();
    
    if (response.ok) {
      console.log('✅ Success\! Response:', responseText);
      fs.writeFileSync('./signed-with-real-key.json', JSON.stringify(body, null, 2));
    } else {
      console.error('❌ Error submitting:', response.status, responseText);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
};

signAndSubmit();
