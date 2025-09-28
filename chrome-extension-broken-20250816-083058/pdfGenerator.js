/* global jspdf */
class PdfGenerator{
  constructor(){
    this.logoDataUrl = null;
    this.pageWmm = 210; // A4 width
    this.pageHmm = 297; // A4 height
  }

  async loadLogo(){
    if(this.logoDataUrl) return this.logoDataUrl;
    const img = await fetch('icons/logo.png').then(r=>r.blob());
    this.logoDataUrl = await new Promise(res=>{
      const fr = new FileReader();
      fr.onload = ()=>res(fr.result);
      fr.readAsDataURL(img);
    });
    return this.logoDataUrl;
  }

  async generate({id, organization, user, timestamp, timezone, url}, screenshotDataUrl){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'a4' });

    const logo = await this.loadLogo();

    // Cover
    doc.addImage(logo, 'PNG', 20, 20, 24, 24);
    doc.setFontSize(18);
    doc.text('ProofVault - Legal Evidence Report', 20, 55);
    doc.setFontSize(11);
    doc.text('AUTHENTICATED • VERIFIED • LEGALLY COMPLIANT', 20, 65);

    doc.setFontSize(13);
    doc.text('Evidence Details', 20, 85);
    doc.setFontSize(11);
    let y = 95;
    const line = (label, value)=>{ doc.text(`${label}: ${value}`, 20, y); y+=8; };
    line('Evidence ID', id);
    line('Organization', organization);
    line('Authenticated User', user);
    line('Capture Date', new Date(timestamp).toLocaleString());
    line('Timezone', timezone);
    line('Website URL', url);

    // Page 2: screenshot
    doc.addPage();
    doc.addImage(logo, 'PNG', 10, 10, 16, 16);
    doc.setFontSize(12);
    doc.text('Captured Webpage', 30, 18);

    // Fit image keeping ratio with margins
    const margin = 10;
    const maxW = this.pageWmm - margin*2;
    const maxH = this.pageHmm - 30 - margin;
    // We need image dims; create image element
    await new Promise((resolve,reject)=>{
      const im = new Image();
      im.onload = ()=>{
        const wr = maxW / im.width;
        const hr = maxH / im.height;
        const r = Math.min(wr, hr);
        const w = im.width * r;
        const h = im.height * r;
        doc.addImage(screenshotDataUrl, 'PNG', margin, 30, w, h);
        resolve();
      };
      im.onerror = reject;
      im.src = screenshotDataUrl;
    });

    // Closing page
    doc.addPage();
    doc.addImage(logo, 'PNG', 20, 20, 24, 24);
    doc.setFontSize(14);
    doc.text('Legal Authentication', 20, 55);
    doc.setFontSize(11);
    const text = [
      'This document constitutes authenticated digital evidence captured using ProofVault technology.',
      'The screenshot and metadata contained herein were captured at the specified date and time using',
      'cryptographically secure methods to ensure integrity and authenticity.',
      '',
      'Evidence Chain of Custody:',
      `• Captured: ${new Date(timestamp).toLocaleString()}`,
      `• Evidence ID: ${id}`
    ].join('\n');
    const split = doc.splitTextToSize(text, this.pageWmm - 40);
    doc.text(split, 20, 70);

    return doc.output('blob');
  }
}