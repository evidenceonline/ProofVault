document.getElementById("searchForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const company = document.getElementById("company").value;
  const username = document.getElementById("username").value;
  const entryId = document.getElementById("entryId").value;

  const params = new URLSearchParams({ company, username, id: entryId });
  const res = await fetch(`http://proofvault.net:4000/search?${params}`);
  const data = await res.json();

  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "";

  if (data.length === 0) {
    resultsDiv.innerHTML = "<p>No results found.</p>";
    return;
  }

  data.forEach((entry, index) => {
    const item = document.createElement("div");
    item.className = "result";
    item.innerHTML = `
      <p><strong>Company:</strong> ${entry.company_name}</p>
      <p><strong>Username:</strong> ${entry.username}</p>
      <p><strong>ID:</strong> ${entry.id}</p>
      <button onclick='showDetails(${JSON.stringify(entry)})'>Details</button>
    `;
    resultsDiv.appendChild(item);
  });
});

function showDetails(entry) {
  const details = document.getElementById("details");
  details.innerHTML = `
    <h3>Entry Details</h3>
    <p><strong>ID:</strong> ${entry.id}</p>
    <p><strong>Filename:</strong> ${entry.pdf_filename}</p>
    <p><strong>Hash:</strong> ${entry.pdf_hash}</p>
    <p><strong>Created at:</strong> ${entry.created_at}</p>
    <p><strong>TX ID:</strong> ${entry.blockchain_tx_id || "Not registered"}</p>
    <a href="http://proofvault.net:4000/download/${entry.id}" target="_blank">Download PDF</a>
  `;
}

