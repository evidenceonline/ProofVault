// Check which accounts are funded in genesis
const genesisAccounts = [
  "DAG8pkb7EhCkT3yU87B2yPBunSCPnEdmX2Wv24sZ",
  "DAG4o41NzhfX6DyYBTTXu6sJa6awm36abJpv89jB",
  "DAG4Zd2W2JxL1f1gsHQCoaKrRonPSSHLgcqD7osU"
];

console.log("Genesis funded accounts:");
genesisAccounts.forEach((addr, idx) => {
  console.log(`  ${idx + 1}. ${addr} - 1000000000000 units`);
});

console.log("\nThese accounts are authorized to submit data to the metagraph.");
console.log("Without the p12 passwords, we have a few options:");
console.log("1. Modify the metagraph to accept any valid signature (dev mode)");
console.log("2. Use the Hydra CLI to generate new funded accounts");
console.log("3. Modify the metagraph validation logic to whitelist specific addresses");
