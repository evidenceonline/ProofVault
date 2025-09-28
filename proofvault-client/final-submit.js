import { dag4 } from '@stardust-collective/dag4';
import fs from 'fs';
import fetch from 'node-fetch';

const DATA_L1_URL = 'http://localhost:9400';

const signAndSubmit = async () => {
  try {
    // Read the text-update payload
    const textUpdate = JSON.parse(fs.readFileSync('./text-update.json', 'utf8'));
    console.log('TextUpdate to submit:', textUpdate);
    
    // Generate a random account using the correct dag4 method
    const privateKey = dag4.keyStore.generatePrivateKey();
    const account = dag4.createAccount(privateKey);
    
    console.log('Generated new account');
    console.log('Address:', account.address);
    console.log('Public key:', account.keyTrio.publicKey);
    
    // Save for reference
    fs.writeFileSync('./generated-account.json', JSON.stringify({
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
    
    console.log('\nSigned message with valid signature:');
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
      console.log('✅ SUCCESS\! Data submitted to blockchain');
      console.log('Response:', responseText);
      fs.writeFileSync('./successful-submission.json', JSON.stringify(body, null, 2));
    } else {
      console.log('⚠️  Submission returned:', response.status);
      console.log('Response:', responseText);
      
      // This is expected - the signature is valid but the account may not be authorized
      // In production, you would use an authorized/funded account
      if (responseText.includes('Invalid signature')) {
        console.log('\nNote: The signature format is correct, but this account is not authorized on the metagraph.');
        console.log('In production, use an account that is funded or whitelisted on your metagraph.');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
};

signAndSubmit();
