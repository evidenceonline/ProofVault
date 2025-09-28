import fetch from "node-fetch";

const endpoints = [
  "/data-application",
  "/data-application/text/my-doc-001",
  "/data",
  "/text",
  "/text/my-doc-001"
];

const base = "http://localhost:9400";

(async () => {
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(base + endpoint);
      console.log(`${endpoint}: ${res.status} ${res.statusText}`);
    } catch (e) {
      console.log(`${endpoint}: Error - ${e.message}`);
    }
  }
})();
