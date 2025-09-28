// api.js
// All comments and strings in English.

class ApiClient {
  async health() {
    const url = PV_CONFIG.API_HEALTH_URL;
    const res = await fetch(url, { method: "GET" }).catch(() => null);
    return !!(res && res.ok);
  }

  async uploadPdf(blob, meta) {
    // Map UI fields -> backend's strict keys
    const company_name = (meta.organization || "").trim();
    const username = (meta.user || "").trim();

    if (!company_name) throw new Error("Upload aborted: organization/company is empty.");
    if (!username) throw new Error("Upload aborted: username is empty.");

    const form = new FormData();

    // ---- TEXT FIELDS FIRST (as some parsers prefer this) ----
    form.append("company_name", company_name); // required by backend
    form.append("username", username);         // required by backend
    form.append("id", meta.id);
    form.append("timestamp", meta.timestamp);
    form.append("url", meta.url);
    if (meta.file_id) form.append("file_id", meta.file_id);

    // Optional: debug what we're sending (avoid logging binary)
    try {
      for (const [k, v] of form.entries()) {
        if (k !== "pdf") console.debug("[ProofVault] form field:", k, v);
      }
    } catch {}

    // ---- FILE FIELD LAST (must be exactly 'pdf') ----
    form.append("pdf", blob, `ProofVault_${meta.id}.pdf`);

    // Upload with timeout to avoid hanging UI
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let res;
    try {
      res = await fetch(PV_CONFIG.API_UPLOAD_URL, {
        method: "POST",
        body: form,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const snippet = text ? ` - ${text.slice(0, 400)}` : "";
      throw new Error(`Upload failed (${res.status})${snippet}`);
    }

    try { return JSON.parse(text); }
    catch { return { success: true }; }
  }

  async getPdf(_id) {
    throw new Error("Direct download not implemented. Use web app viewer.");
  }
}
