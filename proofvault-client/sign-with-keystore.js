import { dag4 } from '@stardust-collective/dag4';
import fs from 'fs';
import fetch from 'node-fetch';

const DATA_L1_URL = 'http://localhost:9400';

const signAndSubmit = async () => {
  try {
    // Read the text-update payload
    const textUpdate = JSON.parse(fs.readFileSync('./text-update.json', 'utf8'));
    console.log('TextUpdate to submit:', textUpdate);
    
    // Load the p12 keystore - trying with empty password (common for dev)
    const p12Path = '/home/nodeadmin/euclid-development-environment2/source/p12-files/token-key.p12';
    const p12Buffer = fs.readFileSync(p12Path);
    
    // Try to import with empty password (typical for dev keystores)
    let account;
    try {
      account = await dag4.keyStore.importKeyStore(p12Buffer, '');
      console.log('Loaded keystore with empty password');
    } catch (e) {
      // If empty doesn't work, try 'password'
      try {
        account = await dag4.keyStore.importKeyStore(p12Buffer, 'password');
        console.log('Loaded keystore with password: "password"');
      } catch (e2) {
        console.error('Could not load keystore. Error:', e2.message);
        return;
      }
    }
    
    console.log('Using address:', account.address);
    
    // Generate the signature
    const encodedMessage = Buffer.from(JSON.stringify(textUpdate)).toString('base64');
    const signature = await dag4.keyStore.dataSign(account.privateKey, encodedMessage);
    
    const publicKey = account.publicKey;
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
    
    console.log('\nSigned message body:');
    console.log(JSON.stringify(body, null, 2));
    
    // Submit to Data L1
    console.log('\nSubmitting to Data L1...');
    const response = await fetch(`${DATA_L1_URL}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const responseText = await response.text();
    
    if (response.ok) {
      console.log('Success\! Response:', responseText);
      
      // Save signed message for reference
      fs.writeFileSync('./signed-with-keystore.json', JSON.stringify(body, null, 2));
      console.log('\nSigned message saved to signed-with-keystore.json');
      
      // Now try to read it back
      console.log('\nReading back from blockchain...');
      const readRes = await fetch(`${DATA_L1_URL}/data-application/text/${textUpdate.id}`);
      if (readRes.ok) {
        const data = await readRes.json();
        console.log('Retrieved data:', data);
      } else {
        console.log('Read failed:', readRes.status);
      }
    } else {
      console.error('Error submitting:', response.status, responseText);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
};

signAndSubmit();
