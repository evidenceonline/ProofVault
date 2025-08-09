const { dag4 } = require('@stardust-collective/dag4');
const fs = require('fs');
const path = require('path');

class DAG4Signer {
  constructor() {
    this.privateKey = null;
    this.publicKey = null;
    this.address = null;
    this.isLoggedIn = false;
    this.isInitializing = false;
    this.initPromise = null;
    this.networkVersion = '2.0';
    this.metagraphId = 'DAG6g4gddZo7WWCA9gFynGDjbhRQdi4ukHbraGaS';
  }

  async init() {
    try {
      const keyPath = path.join(__dirname, '../config/dag4-key.json');
      
      if (fs.existsSync(keyPath)) {
        // Load existing key
        const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        this.privateKey = keyData.privateKey;
        this.publicKey = keyData.publicKey;
        this.address = keyData.address;
        
        // Create account using voting-poll pattern
        this.account = dag4.createAccount();
        this.account.loginPrivateKey(this.privateKey);
        this.publicKey = this.account.publicKey;
        this.address = this.account.address;
        this.isLoggedIn = true;
      } else {
        // Generate new keypair
        this.privateKey = dag4.keyStore.generatePrivateKey();
        
        // Create account using voting-poll pattern
        this.account = dag4.createAccount();
        this.account.loginPrivateKey(this.privateKey);
        this.publicKey = this.account.publicKey;
        this.address = this.account.address;
        this.isLoggedIn = true;
        
        // Save the key for future use
        fs.writeFileSync(keyPath, JSON.stringify({
          privateKey: this.privateKey,
          publicKey: this.publicKey,
          address: this.address
        }, null, 2));
      }
    } catch (error) {
      // Generate temporary account if file operations fail
      this.privateKey = dag4.keyStore.generatePrivateKey();
      this.publicKey = dag4.keyStore.getPublicKeyFromPrivate(this.privateKey);
      this.address = dag4.keyStore.getDagAddressFromPrivateKey(this.privateKey);
      
      try {
        await dag4.account.loginPrivateKey(this.privateKey);
        this.isLoggedIn = true;
      } catch (loginError) {
        this.isLoggedIn = false;
      }
    }
  }

  async ensureInitialized() {
    if (this.isLoggedIn) {
      return;
    }
    
    if (this.isInitializing) {
      return this.initPromise;
    }
    
    this.isInitializing = true;
    this.initPromise = this.init();
    
    try {
      await this.initPromise;
    } finally {
      this.isInitializing = false;
    }
  }

  async signData(data) {
    await this.ensureInitialized();
    
    if (!this.isLoggedIn || !this.privateKey) {
      throw new Error('DAG4 account not logged in');
    }

    const signature = await dag4.keyStore.dataSign(this.privateKey, JSON.stringify(data));
    
    return {
      value: data,
      proofs: [{
        id: this.publicKey,
        signature: signature
      }]
    };
  }

  async createMetagraphTransaction(data) {
    await this.ensureInitialized();
    
    if (!this.isLoggedIn || !this.privateKey) {
      throw new Error('DAG4 account not logged in');
    }

    const textUpdate = {
      id: data.id || Date.now().toString(),
      hash: data.hash
    };

    // FIXED: Use the EXACT same pattern as working NFT example
    // 1. Encode message as base64 before signing
    const encodedMessage = Buffer.from(JSON.stringify(textUpdate)).toString('base64');
    
    // 2. Sign the base64 encoded message (use voting-poll pattern)
    const signature = await dag4.keyStore.dataSign(
      this.privateKey,
      encodedMessage
    );
    
    // 3. Format public key correctly (voting-poll pattern)
    const publicKey = this.account.publicKey;
    const uncompressedPublicKey = publicKey.length === 128 ? '04' + publicKey : publicKey;
    const proofId = uncompressedPublicKey.substring(2);
    
    // 4. Create the exact structure as NFT example
    return {
      value: textUpdate,
      proofs: [{
        id: proofId,
        signature: signature
      }]
    };
  }

  getAddress() {
    return this.address;
  }

  getPublicKey() {
    return this.publicKey;
  }
}

module.exports = new DAG4Signer();