import { dag4 } from '@stardust-collective/dag4';
import fs from 'fs';
import fetch from 'node-fetch';

const DATA_L1_URL = 'http://localhost:9400';

const signAndSubmit = async () => {
  try {
    // Read the text-update payload
    const textUpdate = JSON.parse(fs.readFileSync('./text-update.json', 'utf8'));
    console.log('TextUpdate to submit:', textUpdate);
    
    // Use the account we already generated and added to genesis
    const accountData = JSON.parse(fs.readFileSync('./generated-account.json', 'utf8'));
    const account = dag4.createAccount(accountData.privateKey);
    
    console.log('Using genesis-funded account:');
    console.log('Address:', account.address);
    console.log('(This address was added to genesis.csv with 1000000000000 units)');
    
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
      fs.writeFileSync('./successful-blockchain-submission.json', JSON.stringify({
        request: body,
        response: responseText,
        timestamp: new Date().toISOString()
      }, null, 2));
      
      // Try to read it back
      console.log('\nAttempting to read back from /data-application/text/...');
      const readUrl = `${DATA_L1_URL}/data-application/text/${textUpdate.id}`;
      const readRes = await fetch(readUrl);
      if (readRes.ok) {
        console.log('✅ Read successful:', await readRes.json());
      } else {
        console.log('Read endpoint not yet available (', readRes.status, ')');
        console.log('This is expected - the read endpoint needs to be implemented in the metagraph');
      }
    } else {
      console.error('Submission returned:', response.status);
      console.error('Response:', responseText);
      
      // Note: The metagraph needs to be restarted with the new genesis
      if (responseText.includes('Invalid signature')) {
        console.log('\n⚠️  The metagraph may still be using the old genesis.');
        console.log('The genesis.csv was updated, but metagraph restart may be needed.');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
};

signAndSubmit();
