require("dotenv").config();
const { Client } = require("pg");
const fs = require("fs");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

(async () => {
  const client = new Client();
  await client.connect();

  const filePath = "./test.pdf";
  const pdfBuffer = fs.readFileSync(filePath);
  const pdfHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  const id = uuidv4();
  const companyName = "Acme Corp";
  const username = "jdoe";
  const pdfFilename = "test.pdf";
  const createdAt = new Date();

  const insertQuery = `
    INSERT INTO pdf_records (id, company_name, username, pdf_filename, pdf_hash, pdf_data, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  try {
    const result = await client.query(insertQuery, [
      id,
      companyName,
      username,
      pdfFilename,
      pdfHash,
      pdfBuffer,
      createdAt,
    ]);

    console.log("✅ Inserted record:");
    console.log(result.rows[0]);
  } catch (err) {
    console.error("❌ Error inserting record:", err);
  } finally {
    await client.end();
  }
})();

