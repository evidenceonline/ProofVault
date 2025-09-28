// read-by-id.js
import fetch from "node-fetch";

const DATA_L1 = "http://localhost:9400";
const id = process.argv[2] || "my-doc-001";

const url = DATA_L1 + "/data-application/text/" + encodeURIComponent(id);

(async () => {
  const res = await fetch(url);
  if (res.ok) {
    const json = await res.json();
    console.log("Found:", json);
  } else if (res.status === 404) {
    console.log("Not found");
  } else {
    console.log("Error", res.status, await res.text());
  }
})();
