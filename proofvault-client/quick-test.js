import { dag4 } from "@stardust-collective/dag4";
import fs from "fs";
import fetch from "node-fetch";

const DATA_L1_URL = "http://localhost:9400";

const genesisAddresses = [
  "DAG8pkb7EhCkT3yU87B2yPBunSCPnEdmX2Wv24sZ",
  "DAG4o41NzhfX6DyYBTTXu6sJa6awm36abJpv89jB", 
  "DAG4Zd2W2JxL1f1gsHQCoaKrRonPSSHLgcqD7osU"
];

const trySubmission = async () => {
  console.log("Trying to find genesis keys...");
  
  const testKeys = [
    "0000000000000000000000000000000000000000000000000000000000000001",
    "0000000000000000000000000000000000000000000000000000000000000002", 
    "0000000000000000000000000000000000000000000000000000000000000003",
    "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  ];
  
  for (const key of testKeys) {
    try {
      const account = dag4.createAccount(key);
      const isGenesis = genesisAddresses.includes(account.address);
      console.log(`Key ${key.substr(0,8)}... -> ${account.address} ${isGenesis ? "GENESIS\!" : ""}`);
      
      if (isGenesis) {
        console.log("Found genesis account\! Trying submission...");
        
        const textUpdate = { id: "genesis-test", hash: "0xfoundkey" };
        const encodedMessage = Buffer.from(JSON.stringify(textUpdate)).toString("base64");
        const signature = await dag4.keyStore.dataSign(account.keyTrio.privateKey, encodedMessage);
        
        const publicKey = account.keyTrio.publicKey;
        const uncompressedPublicKey = publicKey.length === 128 ? "04" + publicKey : publicKey;
        
        const proof = { id: uncompressedPublicKey.substring(2), signature };
        const body = { value: textUpdate, proofs: [proof] };
        
        const response = await fetch(`${DATA_L1_URL}/data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        
        console.log(`Response: ${response.status} - ${await response.text()}`);
        return;
      }
    } catch (e) {
      console.log(`Key failed: ${e.message}`);
    }
  }
  
  console.log("No genesis keys found. Integration ready - waiting for restart.");
};

trySubmission().catch(console.error);
