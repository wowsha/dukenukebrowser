(() => {
  const show = (title, detail) => {
    let panel = document.getElementById('engine-diagnostic-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'engine-diagnostic-panel';
      panel.style.cssText = 'position:fixed;z-index:2147483647;left:10px;right:10px;top:10px;max-height:45vh;overflow:auto;background:#160d0d;color:#fff;border:2px solid #ff6b6b;border-radius:10px;padding:14px;font:14px/1.45 system-ui,sans-serif;white-space:pre-wrap;box-shadow:0 4px 24px #0009';
      document.body.appendChild(panel);
    }
    panel.innerHTML = '';
    const h = document.createElement('strong'); h.textContent = title; panel.appendChild(h);
    const p = document.createElement('div'); p.style.marginTop = '8px'; p.textContent = detail; panel.appendChild(p);
    const b = document.createElement('button'); b.textContent = 'Dismiss'; b.style.cssText = 'margin-top:10px;padding:8px 14px'; b.onclick = () => panel.remove(); panel.appendChild(b);
  };
  window.addEventListener('error', (e) => {
    const message = e.message || (e.target && (e.target.src || e.target.href)) || 'Unknown browser error';
    show('Duke Nukem engine startup error', String(message) + '\nFile: ' + (e.filename || 'unknown') + (e.lineno ? ':' + e.lineno : ''));
  }, true);
  window.addEventListener('unhandledrejection', (e) => {
    let reason = e.reason;
    show('Duke Nukem engine startup error', String(reason && (reason.stack || reason.message) || reason || 'Unhandled promise rejection'));
  });
  setTimeout(() => {
    const module = window.Module;
    const canvas = document.querySelector('canvas');
    const ready = !!(module && (module.calledRun || module.runtimeInitialized));
    if (!ready) {
      show('Duke Nukem has not finished starting', [
        'Browser: ' + navigator.userAgent,
        'WebAssembly: ' + (typeof WebAssembly !== 'undefined'),
        'SharedArrayBuffer: ' + (typeof SharedArrayBuffer !== 'undefined'),
        'Cross-origin isolated: ' + !!window.crossOriginIsolated,
        'Canvas found: ' + !!canvas,
        'Module found: ' + !!module,
        'Engine ready flag: ' + ready,
        '',
        'Please send a screenshot of this message.'
      ].join('\n'));
    }
  }, 18000);
})();