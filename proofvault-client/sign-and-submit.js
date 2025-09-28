// sign-and-submit.js
import { dag4 } from "@stardust-collective/dag4";
import fetch from "node-fetch";
import fs from "fs";

const DATA_L1_URL = "http://localhost:9400";

// Generate proof for the message
const generateProof = async (message, privateKey) => {
  const encodedMessage = Buffer.from(JSON.stringify(message)).toString("base64");
  const signature = await dag4.keyStore.dataSign(privateKey, encodedMessage);
  
  const account = dag4.createAccount(privateKey);
  const publicKey = account.keyTrio.publicKey;
  const uncompressedPublicKey = publicKey.length === 128 ? "04" + publicKey : publicKey;
  
  return {
    id: uncompressedPublicKey.substring(2),
    signature
  };
};

// Sign and submit the TextUpdate
const signAndSubmit = async () => {
  try {
    // Read the text-update.json file
    const textUpdate = JSON.parse(fs.readFileSync("./text-update.json", "utf8"));
    console.log("TextUpdate to submit:", textUpdate);
    
    // Generate a test private key (in production, use a real wallet)
    // Using a deterministic test key for demo purposes
    const privateKey = "0000000000000000000000000000000000000000000000000000000000000001";
    const account = dag4.createAccount(privateKey);
    console.log("Using address:", account.address);
    
    // Generate proof
    const proof = await generateProof(textUpdate, privateKey);
    
    // Create the signed message body
    const body = {
      value: textUpdate,
      proofs: [proof]
    };
    
    console.log("\nSigned message body:");
    console.log(JSON.stringify(body, null, 2));
    
    // Submit to Data L1
    console.log("\nSubmitting to Data L1...");
    const response = await fetch(`${DATA_L1_URL}/data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    
    const responseText = await response.text();
    
    if (response.ok) {
      console.log("Success! Response:", responseText);
      
      // Save signed message for reference
      fs.writeFileSync("./signed-text-update.json", JSON.stringify(body, null, 2));
      console.log("\nSigned message saved to signed-text-update.json");
    } else {
      console.error("Error submitting:", response.status, responseText);
    }
    
  } catch (error) {
    console.error("Error:", error);
  }
};

// Run the script
signAndSubmit();
