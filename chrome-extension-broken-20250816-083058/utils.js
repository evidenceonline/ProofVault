function nowIso(){ return new Date().toISOString(); }
function tz(){ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone } catch(e){ return 'UTC' } }
function formatLocal(dt){ return new Date(dt).toLocaleString() }
function genId(){ return `PV_${Date.now()}_${Math.random().toString(36).slice(2,9)}` }