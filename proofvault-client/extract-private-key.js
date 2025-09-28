import forge from 'node-forge';
import fs from 'fs';
import { dag4 } from '@stardust-collective/dag4';

// Extract private key from p12 file using node-forge
const p12Path = '/home/nodeadmin/euclid-development-environment2/source/p12-files/token-key.p12';
const p12Data = fs.readFileSync(p12Path);
const password = 'password';

try {
  console.log('Parsing p12 file...');
  
  // Convert to ASN.1 format and parse
  const p12Asn1 = forge.asn1.fromDer(p12Data.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  
  console.log('P12 parsed successfully');
  
  // Get bags containing certificates and keys
  const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
  if (keyBag && keyBag.length > 0) {
    const privateKey = keyBag[0].key;
    const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
    console.log('Private key PEM:', privateKeyPem);
    
    // Extract the raw private key bytes
    const privateKeyDer = forge.asn1.toDer(forge.pki.privateKeyToAsn1(privateKey));
    console.log('Private key DER length:', privateKeyDer.length);
    
    // Convert to hex format that dag4 expects
    const privateKeyHex = forge.util.bytesToHex(privateKeyDer);
    console.log('Private key hex:', privateKeyHex.substring(0, 64), '...');
    
    // Try to create account with this key
    try {
      const account = dag4.createAccount(privateKeyHex);
      console.log('✅ Success\! Created account from p12 private key');
      console.log('Address:', account.address);
      
      // Save this for future use
      fs.writeFileSync('./p12-extracted-account.json', JSON.stringify({
        address: account.address,
        publicKey: account.keyTrio.publicKey,
        privateKey: account.keyTrio.privateKey
      }, null, 2));
      
    } catch (e) {
      console.log('Failed to create account:', e.message);
      console.log('Trying alternative key format...');
      
      // Try with just the private key raw bytes
      const rawKey = privateKey.d.toString(16).padStart(64, '0');
      console.log('Raw key (hex):', rawKey);
      
      try {
        const account = dag4.createAccount(rawKey);
        console.log('✅ Success with raw key\! Address:', account.address);
        
        fs.writeFileSync('./p12-extracted-account.json', JSON.stringify({
          address: account.address,
          publicKey: account.keyTrio.publicKey,
          privateKey: account.keyTrio.privateKey
        }, null, 2));
      } catch (e2) {
        console.log('Also failed with raw key:', e2.message);
      }
    }
    
  } else {
    console.log('No private key found in p12 file');
  }
  
} catch (error) {
  console.error('Error parsing p12:', error.message);
}
