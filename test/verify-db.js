require("dotenv").config();
const { Client } = require("pg");
const crypto = require("crypto");

const username = process.argv[2];

if (!username) {
  console.error("❌ Usage: node verify-db.js <username>");
  process.exit(1);
}

(async () => {
  const client = new Client();
  await client.connect();

  try {
    const result = await client.query(
      "SELECT id, pdf_filename, pdf_data, pdf_hash FROM pdf_records WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      console.log(`ℹ️ No records found for username: ${username}`);
      return;
    }

    result.rows.forEach((row) => {
      const calculatedHash = crypto
        .createHash("sha256")
        .update(row.pdf_data)
        .digest("hex");

      const verified = calculatedHash === row.pdf_hash;

      console.log(`\n📄 File: ${row.pdf_filename}`);
      console.log(`🆔 ID: ${row.id}`);
      console.log(`✅ Stored hash:     ${row.pdf_hash}`);
      console.log(`🔁 Calculated hash: ${calculatedHash}`);
      console.log(`🔍 Status: ${verified ? "✅ VERIFIED" : "❌ MODIFIED"}`);
    });
  } catch (err) {
    console.error("❌ Error verifying PDFs:", err);
  } finally {
    await client.end();
  }
})();

