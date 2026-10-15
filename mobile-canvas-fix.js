/* Fix the canvas drawing buffer on mobile browsers.
 * The upstream wrapper sizes the CSS box, but some mobile/emulated Chrome
 * sessions leave the actual canvas at the HTML default 300x150. The software
 * renderer then draws into a tiny buffer which is stretched across the screen.
 */
(function () {
  'use strict';
  var canvas = document.getElementById('canvas');
  if (!canvas) return;

  function targetSize() {
    if (localStorage.getItem('e32_display') === 'fill') {
      return {
        width: Math.max(2, Math.floor(window.innerWidth || 300)),
        height: Math.max(2, Math.floor(window.innerHeight || 150))
      };
    }
    if (typeof window.renderBox === 'function') {
      var box = window.renderBox();
      return { width: Math.max(2, box.w | 0), height: Math.max(2, box.h | 0) };
    }
    var rect = canvas.getBoundingClientRect();
    return {
      width: Math.max(2, Math.floor(rect.width || window.innerWidth || 300)),
      height: Math.max(2, Math.floor(rect.height || window.innerHeight || 150))
    };
  }

  var syncing = false;
  function syncBackingSize() {
    if (syncing || !canvas.isConnected) return;
    var size = targetSize();
    if (canvas.width === size.width && canvas.height === size.height) return;
    syncing = true;
    canvas.width = size.width;
    canvas.height = size.height;
    syncing = false;
    console.info('[mobile-canvas] drawing buffer set to ' + canvas.width + 'x' + canvas.height);
  }

  // Run after the upstream fitCanvas() so both the CSS box and drawing buffer
  // agree. Keep a resize listener because the upstream listener captured its
  // original function before this patch was installed.
  var upstreamFit = window.fitCanvas;
  if (typeof upstreamFit === 'function') {
    window.fitCanvas = function () {
      upstreamFit.apply(this, arguments);
      syncBackingSize();
    };
  }
  window.addEventListener('resize', syncBackingSize, { passive: true });
  window.addEventListener('orientationchange', function () {
    requestAnimationFrame(syncBackingSize);
  }, { passive: true });

  // Some Emscripten/SDL paths reset canvas attributes after startup. Restore
  // the intended buffer only when they differ; this does not loop on our own writes.
  new MutationObserver(syncBackingSize).observe(canvas, {
    attributes: true,
    attributeFilter: ['width', 'height']
  });
  syncBackingSize();
})();
