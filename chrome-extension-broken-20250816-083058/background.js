// background.js
const DBG_VERSION = "1.3";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[ProofVault] Service worker installed");
});

async function withDebugger(tabId, fn) {
  const target = { tabId };
  await chrome.debugger.attach(target, DBG_VERSION);
  try {
    return await fn(target);
  } finally {
    try { await chrome.debugger.detach(target); } catch (_) {}
  }
}

async function printFullPdf(tabId) {
  return withDebugger(tabId, async (target) => {
    await chrome.debugger.sendCommand(target, "Page.enable");
    const res = await chrome.debugger.sendCommand(target, "Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      scale: 0.8
    });
    return res.data;
  });
}

async function buildCoverPdf(meta) {
  const esc = (s)=> String(s ?? "").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const css = `
    @page { size: A4; margin: 12mm; }
    html,body { margin:0; padding:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif; color:#0f172a; }
    .wrap { max-width: 170mm; margin: 0 auto; }
    h1 { font-size: 20pt; margin: 0 0 6mm; }
    .kv { font-size: 11pt; color:#334155; display:grid; grid-template-columns: 40mm 1fr; row-gap:2mm; }
    .kv b { color:#0f172a; }
    .muted { color:#64748b; font-size:10pt; margin-top: 6mm; }
    .badge { display:inline-block; padding:2mm 4mm; border:1px solid #e2e8f0; border-radius:6px; font-size:9pt; }
  `;
  const coverHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
  <body>
    <section class="cover">
      <div class="wrap">
        <h1>ProofVault Evidence</h1>
        <div class="kv">
          <div><b>Organization</b></div><div>${esc(meta.organization)}</div>
          <div><b>User</b></div><div>${esc(meta.user)}</div>
          <div><b>URL</b></div><div class="muted">${esc(meta.url)}</div>
          <div><b>Timestamp</b></div><div>${esc(meta.timestamp)}</div>
          <div><b>Evidence ID</b></div><div><span class="badge">${esc(meta.id)}</span></div>
        </div>
      </div>
    </section>
  </body></html>`;

  const dataUrl = "data:text/html;base64," + btoa(unescape(encodeURIComponent(coverHtml)));
  const tab = await chrome.tabs.create({ url: dataUrl, active: false });

  await new Promise((resolve) => {
    const listener = (tabId, info) => {
      if (tabId === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });

  try {
    return await withDebugger(tab.id, async (target) => {
      await chrome.debugger.sendCommand(target, "Page.enable");
      const res = await chrome.debugger.sendCommand(target, "Page.printToPDF", {
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        scale: 0.8
      });
      return res.data;
    });
  } finally {
    try { await chrome.tabs.remove(tab.id); } catch (_) {}
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "PV_PRINT_FULLPDF") {
        const pdfB64 = await printFullPdf(msg.tabId);
        sendResponse({ ok: true, pdfB64 });
        return;
      }
      if (msg?.type === "PV_BUILD_COVER_PDF") {
        const pdfB64 = await buildCoverPdf(msg.meta);
        sendResponse({ ok: true, pdfB64 });
        return;
      }
    } catch (err) {
      console.error("[ProofVault] background error:", err);
      sendResponse({ ok: false, error: err?.message || String(err) });
    }
  })();
  return true;
});
