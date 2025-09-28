import { dag4 } from '@stardust-collective/dag4';
import fs from 'fs';
import fetch from 'node-fetch';

const DATA_L1_URL = 'http://localhost:9400';

const signAndSubmit = async () => {
  try {
    // Read the text-update payload
    const textUpdate = JSON.parse(fs.readFileSync('./text-update.json', 'utf8'));
    console.log('TextUpdate to submit:', textUpdate);
    
    // Load the p12 keystore with the discovered password
    const p12Path = '/home/nodeadmin/euclid-development-environment2/source/p12-files/token-key.p12';
    const p12Buffer = fs.readFileSync(p12Path);
    
    // Use the password we discovered from hydra output
    const account = dag4.account.loadKeyStore(p12Buffer, 'password');
    console.log('✅ Successfully loaded keystore with password: "password"');
    console.log('Address:', account.address);
    console.log('This is a genesis-funded account\!');
    
    // Generate the signature
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
      console.log('🎉 SUCCESS\! Data submitted to blockchain');
      console.log('Response:', responseText);
      fs.writeFileSync('./successful-submission.json', JSON.stringify(body, null, 2));
      
      // Try to read it back
      console.log('\nAttempting to read back...');
      const readUrl = `${DATA_L1_URL}/data-application/text/${textUpdate.id}`;
      const readRes = await fetch(readUrl);
      if (readRes.ok) {
        console.log('✅ Read successful:', await readRes.json());
      } else {
        console.log('Read endpoint status:', readRes.status);
      }
    } else {
      console.error('❌ Submission failed:', response.status, responseText);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
};

// Wait a moment for the metagraph to be ready
console.log('Waiting for metagraph to be ready...');
setTimeout(signAndSubmit, 5000);
