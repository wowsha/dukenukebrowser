(() => {
  const logs = [];
  const maxLogs = 50;
  const startTime = performance.now();
  let pendingPanel = null;
  let waitingForBody = false;

  const stringify = (value) => {
    if (value instanceof Error) return value.stack || (value.name + ': ' + value.message);
    if (typeof value === 'string') return value;
    try {
      const json = JSON.stringify(value);
      return json === undefined ? String(value) : json;
    } catch (_) {
      return String(value);
    }
  };

  const pushLog = (level, values) => {
    const message = values.map(stringify).join(' ').slice(0, 1400);
    logs.push('[' + ((performance.now() - startTime) / 1000).toFixed(1) +
      's] ' + level.toUpperCase() + ': ' + message);
    if (logs.length > maxLogs) logs.splice(0, logs.length - maxLogs);
  };

  // Keep the real browser console working while recording recent output here.
  ['debug', 'log', 'info', 'warn', 'error'].forEach((level) => {
    const original = console[level];
    if (typeof original !== 'function') return;
    console[level] = function (...args) {
      pushLog(level, args);
      return original.apply(console, args);
    };
  });

  const engineState = () => {
    const module = window.Module;
    return [
      'Browser: ' + navigator.userAgent,
      'WebAssembly: ' + (typeof WebAssembly !== 'undefined'),
      'SharedArrayBuffer: ' + (typeof SharedArrayBuffer !== 'undefined'),
      'Cross-origin isolated: ' + !!window.crossOriginIsolated,
      'Canvas found: ' + !!document.querySelector('canvas'),
      'Module found: ' + !!module,
      'Engine ready flag: ' + !!(module && (module.calledRun || module.runtimeInitialized))
    ];
  };

  const reportText = (title, detail) => [
    title,
    detail,
    '',
    'Recent browser console (up to ' + maxLogs + ' entries):',
    ...(logs.length ? logs : ['(No console output captured yet.)'])
  ].join('\n');

  const show = (title, detail) => {
    if (!document.body) {
      pendingPanel = { title, detail };
      if (!waitingForBody) {
        waitingForBody = true;
        document.addEventListener('DOMContentLoaded', () => {
          waitingForBody = false;
          if (pendingPanel) show(pendingPanel.title, pendingPanel.detail);
        }, { once: true });
      }
      return;
    }

    let panel = document.getElementById('engine-diagnostic-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'engine-diagnostic-panel';
      panel.style.cssText = 'position:fixed;z-index:2147483647;left:10px;right:10px;top:10px;max-height:75vh;overflow:auto;background:#160d0d;color:#fff;border:2px solid #ff6b6b;border-radius:10px;padding:14px;font:13px/1.45 system-ui,sans-serif;white-space:pre-wrap;box-shadow:0 4px 24px #0009';
      document.body.appendChild(panel);
    }

    panel.replaceChildren();
    const h = document.createElement('strong');
    h.textContent = title;
    panel.appendChild(h);

    const p = document.createElement('pre');
    p.style.cssText = 'font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0';
    p.textContent = detail + '\n\n' + engineState().join('\n');
    panel.appendChild(p);

    const logTitle = document.createElement('strong');
    logTitle.textContent = 'Recent browser console';
    panel.appendChild(logTitle);
    const logBox = document.createElement('pre');
    logBox.style.cssText = 'font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;background:#0008;padding:8px;border-radius:6px;margin:6px 0';
    logBox.textContent = logs.length ? logs.slice(-30).join('\n') : '(No console output captured yet.)';
    panel.appendChild(logBox);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:10px';
    const copy = document.createElement('button');
    copy.textContent = 'Copy diagnostics + console';
    copy.style.cssText = 'padding:9px 12px;font:inherit';
    copy.onclick = async () => {
      const report = reportText(title, detail + '\n' + engineState().join('\n'));
      try {
        await navigator.clipboard.writeText(report);
        copy.textContent = 'Copied';
      } catch (_) {
        const area = document.createElement('textarea');
        area.value = report;
        area.readOnly = true;
        area.style.cssText = 'width:100%;min-height:120px;margin-top:8px;font:12px monospace';
        panel.appendChild(area);
        area.focus();
        area.select();
        copy.textContent = 'Select the text above and Copy';
      }
    };
    actions.appendChild(copy);

    const dismiss = document.createElement('button');
    dismiss.textContent = 'Dismiss';
    dismiss.style.cssText = 'padding:9px 12px;font:inherit';
    dismiss.onclick = () => panel.remove();
    actions.appendChild(dismiss);
    panel.appendChild(actions);

    const hint = document.createElement('div');
    hint.style.cssText = 'margin-top:8px;font-size:12px;color:#ddd';
    hint.textContent = 'Please send a screenshot of this message, or use “Copy diagnostics + console” to share the startup details.';
    panel.appendChild(hint);
  };

  window.addEventListener('error', (e) => {
    const message = e.message || (e.target && (e.target.src || e.target.href)) || 'Unknown browser error';
    const detail = String(message) + '\nFile: ' + (e.filename || 'unknown') + (e.lineno ? ':' + e.lineno : '');
    pushLog('window.error', [detail]);
    show('Duke Nukem engine startup error', detail);
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const detail = String(reason && (reason.stack || reason.message) || reason || 'Unhandled promise rejection');
    pushLog('unhandledrejection', [detail]);
    show('Duke Nukem engine startup error', detail);
  });

  setTimeout(() => {
    const module = window.Module;
    const ready = !!(module && (module.calledRun || module.runtimeInitialized));
    if (!ready) {
      show('Duke Nukem has not finished starting',
        'Startup timed out after 18 seconds. The captured console output below may explain why.\n\nPlease send a screenshot of this message.');
    }
  }, 18000);
})();