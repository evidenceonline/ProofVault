// popup.js
// All comments and strings in English.

document.addEventListener('DOMContentLoaded', () => {
  const companyInput = document.getElementById('company');
  const userInput = document.getElementById('user');
  const form = document.getElementById('evidenceForm');
  const vaultBtn = document.getElementById('vaultBtn');

  const statusSection = document.getElementById('statusSection');
  const resultSection = document.getElementById('resultSection');
  const statusTitle = document.getElementById('statusTitle');
  const statusMessage = document.getElementById('statusMessage');
  const progressFill = document.getElementById('progressFill');
  const generatedIdEl = document.getElementById('generatedId');
  const captureTs = document.getElementById('captureTimestamp');

  const downloadBtn = document.getElementById('downloadBtn');
  const viewOnlineBtn = document.getElementById('viewOnlineBtn');
  const captureAnotherBtn = document.getElementById('captureAnotherBtn');

  const api = new ApiClient();
  let currentBlob = null;
  let currentId = null;

  function showStatus(title, pct, msg=''){
    statusSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
    statusTitle.textContent = title;
    statusMessage.textContent = msg || '';
    progressFill.style.width = (pct||0) + '%';
  }
  function showResult(){
    statusSection.classList.add('hidden');
    resultSection.classList.remove('hidden');
  }
  function fail(message){
    showStatus('Error', 0, message);
    vaultBtn.disabled = false;
  }
  function b64ToBytes(b64){
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++){ arr[i] = bin.charCodeAt(i); }
    return arr;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    vaultBtn.disabled = true;

    const company = (companyInput.value||'').trim();
    const user = (userInput.value||'').trim();
    if(!company || !user){
      return fail('Please fill both Organization and User.');
    }

    showStatus('Checking backend...', 10);
    const ok = await api.health();
    if(!ok){ return fail('Backend not reachable.'); }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if(!tab){ return fail('No active tab.'); }

    const id = `PV_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
    const meta = {
      id,
      organization: company,
      user,
      timestamp: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      url: tab.url
    };

    showStatus('Preparing cover...', 25);
    const cover = await chrome.runtime.sendMessage({ type:'PV_BUILD_COVER_PDF', meta })
      .catch(err => ({ ok:false, error: err?.message || String(err) }));
    if(!cover || !cover.ok){
      console.error(cover && cover.error);
      return fail('Failed to build cover PDF.');
    }

    showStatus('Printing page...', 45);
    const body = await chrome.runtime.sendMessage({ type:'PV_PRINT_FULLPDF', tabId: tab.id })
      .catch(err => ({ ok:false, error: err?.message || String(err) }));
    if(!body || !body.ok){
      console.error(body && body.error);
      return fail('Failed to print full page PDF.');
    }

    showStatus('Merging PDFs...', 60);
    if(!window.PDFLib || !PDFLib.PDFDocument){
      return fail('pdf-lib is not loaded. Add <script src=\"libs/pdf-lib.min.js\"></script> before popup.js.');
    }
    const merged = await PDFLib.PDFDocument.create();
    const srcCover = await PDFLib.PDFDocument.load(b64ToBytes(cover.pdfB64));
    const srcBody  = await PDFLib.PDFDocument.load(b64ToBytes(body.pdfB64));
    const [coverPage] = await merged.copyPages(srcCover, [0]);
    merged.addPage(coverPage);
    const bodyPages = await merged.copyPages(srcBody, srcBody.getPageIndices());
    bodyPages.forEach(p => merged.addPage(p));
    const mergedBytes = await merged.save();
    currentBlob = new Blob([mergedBytes], { type: 'application/pdf' });

    showStatus('Uploading...', 85);
    try{
      console.debug("[ProofVault] meta being sent:", {
        id: meta.id,
        organization: meta.organization,
        user: meta.user,
        timestamp: meta.timestamp,
        url: meta.url
      });

      await api.uploadPdf(currentBlob, { ...meta });
    }catch(err){
      console.error(err);
      return fail(err && err.message ? err.message : 'Upload failed.');
    }

    currentId = meta.id;
    generatedIdEl.textContent = currentId;
    captureTs.textContent = new Date(meta.timestamp).toLocaleString();
    showResult();
  });

  downloadBtn.addEventListener('click', () => {
    if(!currentBlob) return;
    const url = URL.createObjectURL(currentBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ProofVault_Evidence_${currentId}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });

  viewOnlineBtn.addEventListener('click', () => {
    if(!currentId) return;
    chrome.tabs.create({ url: PV_CONFIG.WEB_APP_URL });
  });

  captureAnotherBtn.addEventListener('click', () => {
    statusSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    vaultBtn.disabled = false;
  });
});
