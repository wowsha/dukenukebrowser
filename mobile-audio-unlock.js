/*
 * Mobile audio unlock for the Duke Nukem 3D browser build.
 *
 * Mobile browsers start every AudioContext in the 'suspended' state and only
 * allow it to run after a user gesture. The engine's audio callbacks keep
 * running while the context is suspended, and in that state the mixer hits a
 * divide-by-zero. Desktop browsers usually start audio immediately, which is
 * why the game runs there.
 *
 * This script records every AudioContext the page creates and resumes them on
 * the first user gesture. It runs before the engine scripts, and it does not
 * touch the engine's code.
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
    var pending = 0;
    contexts.forEach(function (ctx) {
      if (ctx.state !== 'suspended') return;
      pending++;
      ctx.resume().then(function () {
        console.info('[mobile-audio] AudioContext resumed, state=' + ctx.state);
      }, function (error) {
        console.warn('[mobile-audio] resume failed: ' + error);
      });
    });
    return pending;
  }

  // Once a context is running, drop the listeners. If nothing has been created
  // yet, keep listening: the engine may create its context after the first tap.
  function onGesture() {
    resumeAll();
    if (contexts.length && contexts.every(function (ctx) { return ctx.state === 'running'; })) {
      ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (type) {
        document.removeEventListener(type, onGesture, true);
      });
    }
  }

  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (type) {
    document.addEventListener(type, onGesture, true);
  });

  window.DukeAudioUnlock = { resumeAll: resumeAll, contexts: contexts };
})();
