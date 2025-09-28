import { dag4 } from '@stardust-collective/dag4';
import fs from 'fs';
import fetch from 'node-fetch';

const DATA_L1_URL = 'http://localhost:9400';

const signAndSubmit = async () => {
  try {
    // Read the text-update payload
    const textUpdate = JSON.parse(fs.readFileSync('./text-update.json', 'utf8'));
    console.log('TextUpdate to submit:', textUpdate);
    
    // Generate a new account (for testing)
    const account = dag4.generateRandomAccount();
    console.log('Generated new account');
    console.log('Address:', account.address);
    console.log('Public key:', account.keyTrio.publicKey);
    console.log('Private key:', account.keyTrio.privateKey);
    
    // Save the keys for future use
    fs.writeFileSync('./test-account.json', JSON.stringify({
      address: account.address,
      publicKey: account.keyTrio.publicKey,
      privateKey: account.keyTrio.privateKey
    }, null, 2));
    
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
      console.log('✅ Success\! Response:', responseText);
      fs.writeFileSync('./signed-successful.json', JSON.stringify(body, null, 2));
      
      // Try to read it back
      console.log('\nAttempting to read back...');
      const readUrl = `${DATA_L1_URL}/data-application/text/${textUpdate.id}`;
      const readRes = await fetch(readUrl);
      if (readRes.ok) {
        console.log('Read successful:', await readRes.json());
      } else {
        console.log('Read endpoint not available:', readRes.status);
      }
    } else {
      console.error('❌ Submission failed:', response.status, responseText);
      
      // Parse error if JSON
      try {
        const error = JSON.parse(responseText);
        if (error.details) {
          console.log('Error details:', error.details);
        }
      } catch {}
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
};

signAndSubmit();
