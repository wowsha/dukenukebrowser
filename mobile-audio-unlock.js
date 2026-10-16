/*
 * Mobile audio gate for the Duke Nukem 3D browser build.
 *
 * Mobile browsers start every AudioContext in the 'suspended' state and only
 * let audio run after a user gesture. The engine's audio callbacks keep running
 * while the context is suspended, and on Android that hits a divide-by-zero
 * about 0.6s after the engine starts, before the player can tap anything.
 * Desktop browsers start audio immediately, which is why the game runs there.
 *
 * On touch devices this script shows a "Tap to play" screen and loads the
 * engine only after the tap, so the engine's AudioContext is created inside a
 * user gesture and is allowed to run. Desktop loads the engine immediately.
 *
 * The build marks the engine script tag in index.html with
 * type="text/plain" data-dn3d-engine, so the browser does not run it until this
 * script loads it. The engine itself is not modified.
 */
(function () {
  'use strict';

  var contexts = [];

  function track(Ctor) {
    if (!Ctor || Ctor.__dn3dWrapped) return Ctor;
    var Wrapped = function () {
      var ctx = Reflect.construct(Ctor, arguments, new.target || Wrapped);
      contexts.push(ctx);
      return ctx;
    };
    Wrapped.prototype = Ctor.prototype;
    Object.setPrototypeOf(Wrapped, Ctor);
    Object.defineProperty(Wrapped, '__dn3dWrapped', { value: true });
    return Wrapped;
  }

  try {
    if (window.AudioContext) window.AudioContext = track(window.AudioContext);
    if (window.webkitAudioContext) window.webkitAudioContext = track(window.webkitAudioContext);
  } catch (error) {
    console.warn('[mobile-audio] could not wrap AudioContext: ' + error);
  }

  function resumeAll() {
    contexts.forEach(function (ctx) {
      if (ctx.state !== 'suspended') return;
      ctx.resume().then(function () {
        console.info('[mobile-audio] AudioContext resumed, state=' + ctx.state);
      }, function (error) {
        console.warn('[mobile-audio] resume failed: ' + error);
      });
    });
  }

  // On touch devices the engine's audio path crashes on Android, so start the
  // engine with sound disabled. The game stays playable without audio until the
  // underlying fault is fixed. Module.arguments is read when the engine starts,
  // which happens after this script loads it.
  function loadEngine(tag, noSound) {
    if (noSound) {
      window.Module = window.Module || {};
      window.Module.arguments = (window.Module.arguments || []).concat(['-nosound']);
    }
    var script = document.createElement('script');
    script.src = tag.getAttribute('src');
    script.async = false;
    document.head.appendChild(script);
  }

  function mount() {
    var tag = document.querySelector('script[data-dn3d-engine]');
    if (!tag) return;

    var touch = (navigator.maxTouchPoints || 0) > 0;
    try { touch = touch || window.matchMedia('(pointer: coarse)').matches; } catch (_) {}
    if (!touch) {
      loadEngine(tag);
      return;
    }

    var gate = document.createElement('div');
    gate.id = 'dn3d-audio-gate';
    gate.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;' +
      'align-items:center;justify-content:center;background:#000;';

    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'TAP TO PLAY';
    button.style.cssText = 'padding:16px 28px;font:700 18px system-ui,-apple-system,sans-serif;' +
      'letter-spacing:.08em;color:#f4f2ea;background:#8a1c12;' +
      'border:1px solid rgba(255,157,129,.7);border-radius:999px;';
    gate.appendChild(button);
    document.body.appendChild(gate);

    button.addEventListener('click', function () {
      // Create and resume a context inside the gesture so the page is allowed
      // to run audio, then load the engine. The engine's own context is then
      // created after a user gesture and can start.
      try {
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (Ctor) {
          new Ctor().resume().catch(function (error) {
            console.warn('[mobile-audio] probe resume failed: ' + error);
          });
        }
      } catch (error) {
        console.warn('[mobile-audio] could not create probe context: ' + error);
      }
      resumeAll();
      if (gate.parentNode) gate.parentNode.removeChild(gate);
      loadEngine(tag, true);
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  window.DukeAudioUnlock = { resumeAll: resumeAll, contexts: contexts };
})();
