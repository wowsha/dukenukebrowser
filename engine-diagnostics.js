(() => {
  const logs = [];
  const maxLogs = 50;
  const startTime = performance.now();
  const renderProbe = {
    createCalls: 0,
    putCalls: 0,
    lastCreate: null,
    lastCreateError: null,
    lastCreateAt: 0,
    lastPutAt: 0,
    lastCanvasSize: null,
    lastSourceSize: null,
    lastSourceNonBlack: null,
    lastSourceOpaque: null,
    lastSourceSamples: 0,
    hookError: null
  };

  // Observe the actual SDL -> Canvas2D presentation path before EDuke32 loads.
  // This distinguishes an engine that never presents a frame from one that
  // presents a completely black software-renderer buffer.
  const sampleSourceImage = (image) => {
    const data = image && image.data;
    if (!data || !data.length) return;
    const pixels = Math.floor(data.length / 4);
    const stride = Math.max(1, Math.floor(pixels / 1024));
    let nonBlack = 0;
    let opaque = 0;
    let samples = 0;
    for (let p = 0; p < pixels * 4; p += stride * 4) {
      if (data[p] > 8 || data[p + 1] > 8 || data[p + 2] > 8) nonBlack++;
      if (data[p + 3] > 8) opaque++;
      samples++;
    }
    renderProbe.lastSourceSize = (image.width || '?') + 'x' + (image.height || '?');
    renderProbe.lastSourceNonBlack = nonBlack;
    renderProbe.lastSourceOpaque = opaque;
    renderProbe.lastSourceSamples = samples;
  };

  try {
    const canvas2d = window.CanvasRenderingContext2D;
    const proto = canvas2d && canvas2d.prototype;
    if (proto && !proto.__e32RenderProbeInstalled) {
      const originalCreateImageData = proto.createImageData;
      const originalPutImageData = proto.putImageData;
      proto.createImageData = function () {
        const tracked = this.canvas && this.canvas.id === 'canvas';
        if (tracked) {
          renderProbe.createCalls++;
          renderProbe.lastCreate = Array.from(arguments).slice(0, 2).join('x');
          renderProbe.lastCreateAt = performance.now();
        }
        try {
          return originalCreateImageData.apply(this, arguments);
        } catch (error) {
          if (tracked) renderProbe.lastCreateError = stringify(error);
          throw error;
        }
      };
      proto.putImageData = function (image) {
        const tracked = this.canvas && this.canvas.id === 'canvas';
        if (tracked) {
          renderProbe.putCalls++;
          renderProbe.lastPutAt = performance.now();
          renderProbe.lastCanvasSize = this.canvas.width + 'x' + this.canvas.height;
          if (renderProbe.putCalls === 1 || renderProbe.putCalls % 12 === 1) {
            try { sampleSourceImage(image); } catch (_) {}
          }
        }
        return originalPutImageData.apply(this, arguments);
      };
      Object.defineProperty(proto, '__e32RenderProbeInstalled', { value: true });
    }
  } catch (error) {
    renderProbe.hookError = stringify(error);
  }

  const renderProbeState = (module) => {
    const sdl = module && module.SDL2;
    const image = sdl && sdl.image;
    const ctxCanvas = sdl && sdl.ctxCanvas;
    const now = performance.now();
    return {
      createCalls: renderProbe.createCalls,
      lastCreate: renderProbe.lastCreate,
      lastCreateError: renderProbe.lastCreateError,
      secondsSinceCreate: renderProbe.lastCreateAt ? +((now - renderProbe.lastCreateAt) / 1000).toFixed(1) : null,
      putCalls: renderProbe.putCalls,
      secondsSincePut: renderProbe.lastPutAt ? +((now - renderProbe.lastPutAt) / 1000).toFixed(1) : null,
      lastCanvasSize: renderProbe.lastCanvasSize,
      lastSourceSize: renderProbe.lastSourceSize,
      sourceNonBlackSamples: renderProbe.lastSourceNonBlack,
      sourceOpaqueSamples: renderProbe.lastSourceOpaque,
      sourceSamples: renderProbe.lastSourceSamples,
      sdlBufferSize: sdl ? ((sdl.w || '?') + 'x' + (sdl.h || '?')) : '(Module.SDL2 absent)',
      sdlImageSize: image ? ((image.width || '?') + 'x' + (image.height || '?')) : '(SDL2 image absent)',
      sdlContextCanvas: ctxCanvas ? (ctxCanvas.id || ctxCanvas.tagName || '(unlabelled canvas)') : '(SDL2 context absent)',
      hookError: renderProbe.hookError
    };
  };

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

  let diagnosticRafFrames = 0;
  let diagnosticRafLast = performance.now();
  let diagnosticRafFps = 0;
  const countDiagnosticFrames = (now) => {
    diagnosticRafFrames++;
    if (now - diagnosticRafLast >= 1000) {
      diagnosticRafFps = Math.round(diagnosticRafFrames * 1000 / (now - diagnosticRafLast));
      diagnosticRafFrames = 0;
      diagnosticRafLast = now;
    }
    requestAnimationFrame(countDiagnosticFrames);
  };
  requestAnimationFrame(countDiagnosticFrames);

  const inspectCanvas = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { summary: 'canvas missing', black: true, sampled: false, kind: 'missing' };
    if (!canvas.width || !canvas.height) return { summary: 'canvas backing size is zero', black: true, sampled: false, kind: 'zero-size' };
    const w = Math.min(canvas.width, 64);
    const h = Math.min(canvas.height, 64);
    const sx = Math.max(0, Math.floor((canvas.width - w) / 2));
    const sy = Math.max(0, Math.floor((canvas.height - h) / 2));
    try {
      const ctx2d = canvas.getContext('2d');
      if (ctx2d) {
        const pixels = ctx2d.getImageData(sx, sy, w, h).data;
        let nonBlack = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] > 8 || pixels[i + 1] > 8 || pixels[i + 2] > 8) nonBlack++;
        }
        const total = w * h;
        return { summary: '2D center sample: ' + nonBlack + '/' + total + ' non-black pixels', black: nonBlack <= 1, sampled: true, kind: '2d', nonBlack, total };
      }
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        if (gl.isContextLost()) return { summary: 'WebGL context is LOST', black: true, sampled: false, kind: 'webgl-lost' };
        const pixels = new Uint8Array(w * h * 4);
        gl.finish();
        gl.readPixels(sx, Math.max(0, canvas.height - sy - h), w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let nonBlack = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] > 8 || pixels[i + 1] > 8 || pixels[i + 2] > 8) nonBlack++;
        }
        const total = w * h;
        const attrs = gl.getContextAttributes() || {};
        return { summary: 'WebGL center sample: ' + nonBlack + '/' + total + ' non-black pixels; context=' + (gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl') + ', alpha=' + attrs.alpha, black: nonBlack <= 1, sampled: true, kind: 'webgl', nonBlack, total };
      }
      return { summary: 'No readable 2D or WebGL context (canvas may use another context)', black: false, sampled: false, kind: 'unknown' };
    } catch (e) {
      return { summary: 'Canvas pixel sample failed: ' + stringify(e), black: false, sampled: false, kind: 'error' };
    }
  };

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
    const canvasState = inspectCanvas();

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
      'Canvas sample: ' + canvasState.summary,
      'Canvas context kind: ' + canvasState.kind,
      'SDL render probe: ' + JSON.stringify(renderProbeState(module)),
      'Engine video-frame state: ' + JSON.stringify(window.__e32VideoProbe || '(not exposed by engine yet)'),
      'Browser animation-frame rate: ' + diagnosticRafFps + ' fps',
      'Page visibility: ' + document.visibilityState,
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

    // Freeze the first diagnostic panel. A crashing main loop can dispatch
    // repeated unhandled errors every frame; rebuilding the panel changes FPS
    // and text selection under the user's finger, making the error impossible
    // to copy. Console capture continues in the background, but this report is
    // immutable once shown.
    if (document.getElementById('engine-diagnostic-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'engine-diagnostic-panel';
    panel.style.cssText = 'position:fixed;z-index:2147483647;left:10px;right:10px;top:10px;max-height:82vh;overflow:auto;background:#160d0d;color:#fff;border:2px solid #ff6b6b;border-radius:10px;padding:14px;font:12px/1.4 system-ui,sans-serif;white-space:pre-wrap;box-shadow:0 4px 24px #0009';
    document.body.appendChild(panel);

    const frozenReport = reportText(title, detail);
    const h = document.createElement('strong');
    h.textContent = title;
    panel.appendChild(h);

    const p = document.createElement('pre');
    p.style.cssText = 'font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0';
    p.textContent = frozenReport;
    panel.appendChild(p);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:10px';

    const copy = document.createElement('button');
    copy.textContent = 'Copy diagnostics + console';
    copy.style.cssText = 'padding:9px 12px;font:inherit';
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(frozenReport);
        copy.textContent = 'Copied';
      } catch (_) {
        const area = document.createElement('textarea');
        area.value = frozenReport;
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
    const canvasState = inspectCanvas();
    if (runtimeReady && menuReady && !canvasState.black) return;
    const message = [
      'Startup/display check after 18 seconds.',
      'Emscripten runtime initialized: ' + runtimeReady,
      'Game-state bridge available: ' + menuReady,
      'Canvas check: ' + canvasState.summary,
      'The captured console and canvas details below can help isolate a video/engine-loop failure.'
    ].join('\n');
    show(runtimeReady
      ? 'Duke Nukem runtime is running, but the game screen may be stuck'
      : 'Duke Nukem has not finished starting', message);
  }, 18000);
})();