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
    // Emscripten's upstream printErr sends normal engine INFO/WARN lines to
    // console.error, so trust the engine's embedded severity when present.
    const nativeSeverity = /\b(INFO|WARN|WARNING|ERROR|DEBUG|TRACE)\s*\|/.exec(message);
    const displayLevel = nativeSeverity ? nativeSeverity[1] : level.toUpperCase();
    logs.push('[' + ((performance.now() - startTime) / 1000).toFixed(1) +
      's] ' + displayLevel + ': ' + message);
    if (logs.length > maxLogs) logs.splice(0, logs.length - maxLogs);
  };

  // Keep the real browser console working while recording recent output.
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
    const canvas = document.querySelector('canvas');
    const rect = canvas ? canvas.getBoundingClientRect() : null;
    const menu = window.__e32menu;
    const runtimeReady = !!(module && module.ccall && module._Web_SetMute);
    let menuState = '(not exposed yet)';
    if (menu && typeof menu === 'object') {
      try {
        menuState = JSON.stringify({
          game: menu.game, gm: menu.gm, open: menu.open, id: menu.id,
          sel: menu.sel, players: menu.np, sync: menu.sync
        });
      } catch (_) { menuState = '(could not read menu state)'; }
    }

    let canvas2d = '(not checked)';
    if (canvas) {
      try {
        const ctx = canvas.getContext('2d');
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          const w = Math.min(canvas.width, 32);
          const h = Math.min(canvas.height, 32);
          const pixels = ctx.getImageData(0, 0, w, h).data;
          let nonBlack = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i] > 8 || pixels[i + 1] > 8 || pixels[i + 2] > 8) nonBlack++;
          }
          canvas2d = '2D sample: ' + nonBlack + '/' + (w * h) + ' non-black pixels in top-left ' + w + 'x' + h;
        } else {
          canvas2d = ctx ? '2D canvas has zero backing size' : '2D context unavailable or another context type is active';
        }
      } catch (e) {
        canvas2d = '2D sample failed: ' + stringify(e);
      }
    }

    let priorCrash = '(none saved)';
    try {
      const raw = localStorage.getItem('eduke32/lastCrash');
      if (raw) {
        const parsed = JSON.parse(raw);
        priorCrash = [parsed.kind, parsed.msg, parsed.stack].filter(Boolean).join(' — ').slice(0, 500);
      }
    } catch (_) { priorCrash = '(unreadable)'; }

    return [
      'Browser: ' + navigator.userAgent,
      'WebAssembly available: ' + (typeof WebAssembly !== 'undefined'),
      'SharedArrayBuffer: ' + (typeof SharedArrayBuffer !== 'undefined'),
      'Cross-origin isolated: ' + !!window.crossOriginIsolated,
      'Module found: ' + !!module,
      'Emscripten runtime initialized (export check): ' + runtimeReady,
      'Game-state bridge available: ' + !!menu,
      'Game-state bridge data: ' + menuState,
      'Canvas found: ' + !!canvas,
      'Canvas backing size: ' + (canvas ? canvas.width + ' x ' + canvas.height : '(missing)'),
      'Canvas CSS size: ' + (rect ? Math.round(rect.width) + ' x ' + Math.round(rect.height) : '(missing)'),
      'Canvas sample: ' + canvas2d,
      'Saved previous crash: ' + priorCrash,
      'Note: calledRun/runtimeInitialized flags are not reliable for this EDuke32 build.'
    ];
  };

  const reportText = (title, detail) => [
    title,
    detail,
    '',
    ...engineState(),
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
      panel.style.cssText = 'position:fixed;z-index:2147483647;left:10px;right:10px;top:10px;max-height:82vh;overflow:auto;background:#160d0d;color:#fff;border:2px solid #ff6b6b;border-radius:10px;padding:14px;font:12px/1.4 system-ui,sans-serif;white-space:pre-wrap;box-shadow:0 4px 24px #0009';
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
      const report = reportText(title, detail);
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
        copy.textContent = 'Select text above and Copy';
      }
    };
    actions.appendChild(copy);

    const reset = document.createElement('button');
    reset.textContent = 'Restart with default settings';
    reset.style.cssText = 'padding:9px 12px;font:inherit';
    reset.onclick = () => {
      if (!window.confirm('Reset saved display and game configuration files? Imported game data is kept.')) return;
      try {
        [
          'eduke32/cfg/eduke32.cfg',
          'eduke32/cfg/settings.cfg',
          'eduke32/cfg/m32_settings.cfg',
          'e32_res',
          'e32_display'
        ].forEach((key) => localStorage.removeItem(key));
      } catch (_) {}
      location.reload();
    };
    actions.appendChild(reset);

    const dismiss = document.createElement('button');
    dismiss.textContent = 'Dismiss';
    dismiss.style.cssText = 'padding:9px 12px;font:inherit';
    dismiss.onclick = () => panel.remove();
    actions.appendChild(dismiss);
    panel.appendChild(actions);

    const hint = document.createElement('div');
    hint.style.cssText = 'margin-top:8px;font-size:12px;color:#ddd';
    hint.textContent = 'Please send a screenshot of this message, or use “Copy diagnostics + console” to share startup details.';
    panel.appendChild(hint);
  };

  window.addEventListener('error', (e) => {
    const message = e.message || (e.target && (e.target.src || e.target.href)) || 'Unknown browser error';
    const detail = String(message) + '\nFile: ' + (e.filename || 'unknown') + (e.lineno ? ':' + e.lineno : '');
    pushLog('window.error', [detail]);
    show('Duke Nukem browser error', detail);
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const detail = String(reason && (reason.stack || reason.message) || reason || 'Unhandled promise rejection');
    pushLog('unhandledrejection', [detail]);
    show('Duke Nukem browser error', detail);
  });

  setTimeout(() => {
    const module = window.Module;
    const runtimeReady = !!(module && module.ccall && module._Web_SetMute);
    const menuReady = !!(window.__e32menu && typeof window.__e32menu === 'object');
    const canvas = document.querySelector('canvas');
    const message = [
      'No game-state menu information was detected after 18 seconds.',
      'Emscripten runtime initialized: ' + runtimeReady,
      'Game-state bridge available: ' + menuReady,
      'The captured console and canvas details below can help isolate a video/engine-loop failure.'
    ].join('\n');
    show(runtimeReady
      ? 'Duke Nukem runtime is running, but the game screen may be stuck'
      : 'Duke Nukem has not finished starting', message);
  }, 18000);
})();