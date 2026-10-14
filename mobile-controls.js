/*
 * Touch controls for Duke Nukem 3D WebAssembly.
 * Copyright (c) 2026 wowsha
 * SPDX-License-Identifier: MIT
 *
 * This is a small browser-side input layer. The EDuke32 engine and game data
 * are supplied by the upstream project; this file does not include either.
 */
(function () {
  'use strict';

  var params;
  try { params = new URLSearchParams(location.search); } catch (_) { params = { get: function () { return null; } }; }
  var touchDevice = (navigator.maxTouchPoints || 0) > 0;
  try { touchDevice = touchDevice || window.matchMedia('(pointer: coarse)').matches; } catch (_) {}
  if (!touchDevice && params.get('touch') !== '1') return;

  var canvas = document.getElementById('canvas');
  if (!canvas) return;

  var KEY = {
    ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    ControlLeft: { key: 'Control', code: 'ControlLeft', keyCode: 17 },
    Space: { key: ' ', code: 'Space', keyCode: 32 },
    KeyA: { key: 'a', code: 'KeyA', keyCode: 65 },
    KeyZ: { key: 'z', code: 'KeyZ', keyCode: 90 },
    ShiftLeft: { key: 'Shift', code: 'ShiftLeft', keyCode: 16 },
    BracketRight: { key: ']', code: 'BracketRight', keyCode: 221 },
    AltLeft: { key: 'Alt', code: 'AltLeft', keyCode: 18 }
  };

  // A key stays down while any control is holding it; this prevents one button
  // from releasing a key that is still requested by a different control.
  var ownersByKey = new Map();
  var keysByOwner = new Map();

  function emitKey(type, name) {
    var k = KEY[name];
    if (!k) return;
    var event;
    try {
      event = new KeyboardEvent(type, {
        key: k.key, code: k.code, keyCode: k.keyCode, which: k.keyCode,
        charCode: 0, bubbles: true, cancelable: true, composed: true
      });
      // Some mobile WebViews ignore legacy numeric init fields. SDL's browser
      // keyboard bridge still reads keyCode/which, so define them when possible.
      ['keyCode', 'which'].forEach(function (prop) {
        try { Object.defineProperty(event, prop, { get: function () { return k.keyCode; } }); } catch (_) {}
      });
    } catch (_) {
      event = document.createEvent('Event');
      event.initEvent(type, true, true);
      event.key = k.key; event.code = k.code; event.keyCode = k.keyCode; event.which = k.keyCode;
    }
    canvas.dispatchEvent(event);
  }

  function press(owner, key) {
    var byKey = ownersByKey.get(key);
    if (!byKey) {
      byKey = new Set();
      ownersByKey.set(key, byKey);
      emitKey('keydown', key);
    }
    byKey.add(owner);
    var byOwner = keysByOwner.get(owner);
    if (!byOwner) { byOwner = new Set(); keysByOwner.set(owner, byOwner); }
    byOwner.add(key);
  }

  function releaseOne(owner, key) {
    var byOwner = keysByOwner.get(owner);
    if (byOwner) {
      byOwner.delete(key);
      if (!byOwner.size) keysByOwner.delete(owner);
    }
    var byKey = ownersByKey.get(key);
    if (!byKey) return;
    byKey.delete(owner);
    if (!byKey.size) {
      ownersByKey.delete(key);
      emitKey('keyup', key);
    }
  }

  function setOwnerKeys(owner, wanted) {
    var current = keysByOwner.get(owner) || new Set();
    wanted = new Set(wanted);
    Array.from(current).forEach(function (key) { if (!wanted.has(key)) releaseOne(owner, key); });
    wanted.forEach(function (key) { if (!current.has(key)) press(owner, key); });
  }

  function releaseOwner(owner) {
    var current = keysByOwner.get(owner);
    if (!current) return;
    Array.from(current).forEach(function (key) { releaseOne(owner, key); });
  }

  function releaseAll() {
    Array.from(keysByOwner.keys()).forEach(releaseOwner);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  var style = el('style');
  style.textContent = [
    '#dn3d-touch-ui{display:none;position:fixed;inset:0;z-index:18;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;font-family:system-ui,-apple-system,sans-serif;color:#fff}',
    '#dn3d-touch-ui.enabled{display:block}',
    '#dn3d-touch-ui.settings-open{display:none}',
    '#dn3d-look{position:absolute;top:64px;right:0;bottom:154px;width:57vw;max-width:620px;min-width:130px;pointer-events:auto;touch-action:none;outline:none}',
    '#dn3d-look:after{content:"DRAG TO LOOK";position:absolute;top:14px;right:12px;color:rgba(255,255,255,.30);font-size:10px;font-weight:800;letter-spacing:.12em;text-shadow:0 1px 3px #000;pointer-events:none}',
    '#dn3d-stick{position:absolute;left:max(14px,env(safe-area-inset-left));bottom:max(18px,env(safe-area-inset-bottom));width:clamp(116px,27vw,158px);height:clamp(116px,27vw,158px);border-radius:50%;border:1px solid rgba(255,255,255,.28);background:radial-gradient(circle at 50% 45%,rgba(65,70,76,.55),rgba(12,14,17,.62));box-shadow:inset 0 0 0 9px rgba(255,255,255,.035),0 5px 24px rgba(0,0,0,.30);pointer-events:auto;touch-action:none}',
    '#dn3d-stick:before{content:"";position:absolute;left:50%;top:50%;width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.36);transform:translate(-50%,-50%)}',
    '#dn3d-knob{position:absolute;left:50%;top:50%;width:48%;height:48%;border-radius:50%;transform:translate(-50%,-50%);border:1px solid rgba(255,255,255,.42);background:linear-gradient(145deg,rgba(232,233,233,.34),rgba(80,84,88,.38));box-shadow:0 4px 12px rgba(0,0,0,.4);pointer-events:none}',
    '#dn3d-actions{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(3,clamp(52px,14vw,66px));gap:8px;align-items:end;pointer-events:auto}',
    '.dn3d-btn{height:clamp(52px,14vw,66px);padding:0 4px;border-radius:50%;border:1px solid rgba(255,255,255,.34);background:linear-gradient(145deg,rgba(43,47,51,.86),rgba(11,13,16,.88));box-shadow:0 4px 14px rgba(0,0,0,.38),inset 0 1px rgba(255,255,255,.12);color:#f4f2ea;font-size:10px;font-weight:900;letter-spacing:.045em;text-shadow:0 1px 2px #000;display:flex;align-items:center;justify-content:center;text-align:center;pointer-events:auto;touch-action:none;outline:none;-webkit-tap-highlight-color:transparent}',
    '.dn3d-btn:active,.dn3d-btn.down{transform:scale(.94);filter:brightness(1.28);border-color:rgba(255,255,255,.76)}',
    '.dn3d-btn.fire{background:linear-gradient(145deg,rgba(190,47,30,.96),rgba(99,17,13,.96));border-color:rgba(255,157,129,.7);height:clamp(58px,15vw,72px);width:clamp(58px,15vw,72px);justify-self:center}',
    '.dn3d-btn.use{color:#ffe59a;border-color:rgba(245,196,0,.62)}',
    '.dn3d-btn.jump{color:#b8e8ff;border-color:rgba(85,179,255,.5)}',
    '.dn3d-btn.small{height:clamp(44px,11vw,54px);font-size:9px;opacity:.93}',
    '#dn3d-hint{position:absolute;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);padding:6px 10px;border:1px solid rgba(255,255,255,.15);border-radius:999px;background:rgba(0,0,0,.43);color:rgba(255,255,255,.72);font-size:10px;letter-spacing:.04em;white-space:nowrap;pointer-events:none}',
    '@media (orientation:landscape){#dn3d-look{top:44px;bottom:124px;width:53vw}#dn3d-stick{width:clamp(105px,24vh,142px);height:clamp(105px,24vh,142px);bottom:max(12px,env(safe-area-inset-bottom))}#dn3d-actions{grid-template-columns:repeat(3,clamp(46px,12vh,60px));gap:6px;bottom:max(10px,env(safe-area-inset-bottom))}.dn3d-btn{height:clamp(46px,12vh,60px);font-size:9px}.dn3d-btn.fire{height:clamp(50px,13vh,66px);width:clamp(50px,13vh,66px)}}',
    '@media (max-width:360px){#dn3d-actions{grid-template-columns:repeat(3,48px);gap:5px;right:8px}.dn3d-btn{height:48px;font-size:9px}.dn3d-btn.fire{height:54px;width:54px}#dn3d-stick{left:8px;bottom:12px;width:112px;height:112px}}',
    '@media (hover:hover) and (pointer:fine){#dn3d-touch-ui:not(.force){display:none!important}}'
  ].join('\n');
  document.head.appendChild(style);

  var ui = el('div');
  ui.id = 'dn3d-touch-ui';
  if (params.get('touch') === '1') ui.classList.add('force');

  var look = el('div');
  look.id = 'dn3d-look';
  look.setAttribute('aria-label', 'Drag here to turn and look');
  look.setAttribute('role', 'application');
  look.setAttribute('tabindex', '-1');

  var hint = el('div', '', 'LEFT STICK · RIGHT SIDE TO LOOK');
  hint.id = 'dn3d-hint';

  var stick = el('div');
  stick.id = 'dn3d-stick';
  stick.setAttribute('role', 'application');
  stick.setAttribute('aria-label', 'Movement joystick');
  var knob = el('div');
  knob.id = 'dn3d-knob';
  stick.appendChild(knob);

  var actions = el('div');
  actions.id = 'dn3d-actions';

  var controls = [
    { label: 'FIRE', key: 'ControlLeft', cls: 'fire', title: 'Fire (Ctrl)' },
    { label: 'USE', key: 'Space', cls: 'use', title: 'Use / open (Space)' },
    { label: 'JUMP', key: 'KeyA', cls: 'jump', title: 'Jump (A)' },
    { label: 'DUCK', key: 'KeyZ', cls: 'small', title: 'Duck (Z)' },
    { label: 'RUN', key: 'ShiftLeft', cls: 'small', title: 'Run (Shift)' },
    { label: 'NEXT', key: 'BracketRight', cls: 'small', title: 'Next weapon (])' }
  ];

  controls.forEach(function (control) {
    var button = el('button', 'dn3d-btn ' + control.cls, control.label);
    button.type = 'button';
    button.title = control.title;
    button.setAttribute('aria-label', control.title);
    var owner = 'button-' + control.key;
    button.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      event.stopPropagation();
      try { button.setPointerCapture(event.pointerId); } catch (_) {}
      button.classList.add('down');
      press(owner, control.key);
      try { if (navigator.vibrate) navigator.vibrate(7); } catch (_) {}
    });
    function up(event) {
      if (event) { event.preventDefault(); event.stopPropagation(); }
      button.classList.remove('down');
      releaseOwner(owner);
    }
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', function () { up(); });
    button.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    actions.appendChild(button);
  });

  ui.appendChild(look);
  ui.appendChild(hint);
  ui.appendChild(stick);
  ui.appendChild(actions);
  document.body.appendChild(ui);

  var stickPointer = null;
  var stickRect = null;

  function stickPosition(clientX, clientY) {
    if (!stickRect) stickRect = stick.getBoundingClientRect();
    var cx = stickRect.left + stickRect.width / 2;
    var cy = stickRect.top + stickRect.height / 2;
    var max = stickRect.width * 0.29;
    var dx = clientX - cx;
    var dy = clientY - cy;
    var length = Math.sqrt(dx * dx + dy * dy);
    if (length > max) { dx = dx * max / length; dy = dy * max / length; }
    knob.style.left = (50 + dx / stickRect.width * 100) + '%';
    knob.style.top = (50 + dy / stickRect.height * 100) + '%';

    var nx = dx / max;
    var ny = dy / max;
    var next = [];
    if (ny < -0.28) next.push('ArrowUp');
    if (ny > 0.28) next.push('ArrowDown');
    if (nx < -0.32) { next.push('AltLeft', 'ArrowLeft'); }
    if (nx > 0.32) { next.push('AltLeft', 'ArrowRight'); }
    setOwnerKeys('stick', next);
  }

  function resetStick() {
    stickPointer = null;
    stickRect = null;
    knob.style.left = '50%';
    knob.style.top = '50%';
    releaseOwner('stick');
  }

  stick.addEventListener('pointerdown', function (event) {
    event.preventDefault();
    event.stopPropagation();
    stickPointer = event.pointerId;
    stickRect = stick.getBoundingClientRect();
    try { stick.setPointerCapture(event.pointerId); } catch (_) {}
    stickPosition(event.clientX, event.clientY);
  });
  stick.addEventListener('pointermove', function (event) {
    if (event.pointerId !== stickPointer) return;
    event.preventDefault();
    stickPosition(event.clientX, event.clientY);
  });
  stick.addEventListener('pointerup', function (event) {
    if (event.pointerId === stickPointer) resetStick();
  });
  stick.addEventListener('pointercancel', resetStick);
  stick.addEventListener('lostpointercapture', resetStick);

  // Feed relative motion into SDL/Emscripten without relying on pointer lock,
  // which mobile browsers either don't support or don't allow for touch input.
  var lookPointer = null;
  var lookTouchX = 0;
  var lookTouchY = 0;
  var virtualMouseX = 0;
  var virtualMouseY = 0;

  function sendLook(dx, dy) {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var gain = 1.35;
    virtualMouseX = Math.max(rect.left + 3, Math.min(rect.right - 3, virtualMouseX + dx));
    virtualMouseY = Math.max(rect.top + 3, Math.min(rect.bottom - 3, virtualMouseY + dy));
    var mx = virtualMouseX;
    var my = virtualMouseY;

    var event;
    try {
      event = new MouseEvent('mousemove', {
        bubbles: true, cancelable: true, view: window,
        clientX: mx, clientY: my, screenX: mx, screenY: my,
        button: 0, buttons: 0
      });
      try { Object.defineProperty(event, 'movementX', { get: function () { return dx * gain; } }); } catch (_) {}
      try { Object.defineProperty(event, 'movementY', { get: function () { return dy * gain; } }); } catch (_) {}
    } catch (_) {
      event = document.createEvent('MouseEvent');
      event.initMouseEvent('mousemove', true, true, window, 0, mx, my, mx, my, false, false, false, false, 0, null);
      try { Object.defineProperty(event, 'movementX', { value: dx * gain }); } catch (_) {}
      try { Object.defineProperty(event, 'movementY', { value: dy * gain }); } catch (_) {}
    }
    canvas.dispatchEvent(event);
  }

  look.addEventListener('pointerdown', function (event) {
    event.preventDefault();
    event.stopPropagation();
    lookPointer = event.pointerId;
    lookTouchX = event.clientX;
    lookTouchY = event.clientY;
    var rect = canvas.getBoundingClientRect();
    virtualMouseX = rect.left + rect.width / 2;
    virtualMouseY = rect.top + rect.height / 2;
    try { look.setPointerCapture(event.pointerId); } catch (_) {}
  });
  look.addEventListener('pointermove', function (event) {
    if (event.pointerId !== lookPointer) return;
    event.preventDefault();
    var dx = event.clientX - lookTouchX;
    var dy = event.clientY - lookTouchY;
    lookTouchX = event.clientX;
    lookTouchY = event.clientY;
    sendLook(dx, dy);
  });
  function stopLook(event) {
    if (event && event.pointerId !== lookPointer) return;
    lookPointer = null;
  }
  look.addEventListener('pointerup', stopLook);
  look.addEventListener('pointercancel', stopLook);
  look.addEventListener('lostpointercapture', function () { lookPointer = null; });

  // Enable only after the boot screen fades away; hide controls over Settings.
  var loader = document.getElementById('loader');
  var settings = document.getElementById('settings');

  function syncVisibility() {
    var loaderGone = !loader || loader.style.display === 'none';
    ui.classList.toggle('enabled', loaderGone);
    var settingsOpen = settings && settings.classList.contains('open');
    ui.classList.toggle('settings-open', !!settingsOpen);
    if (!loaderGone || settingsOpen) releaseAll();
  }
  if (loader && window.MutationObserver) {
    new MutationObserver(syncVisibility).observe(loader, { attributes: true, attributeFilter: ['style', 'class'] });
  }
  if (settings && window.MutationObserver) {
    new MutationObserver(syncVisibility).observe(settings, { attributes: true, attributeFilter: ['class', 'style'] });
  }
  window.addEventListener('resize', function () { stickRect = null; });
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAll(); });
  syncVisibility();

  // Helpful for debugging on desktop: append ?touch=1 to force the overlay.
  window.DukeTouchControls = { releaseAll: releaseAll };
})();
