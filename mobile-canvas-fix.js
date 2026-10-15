/* Fix only the browser's default canvas size before EDuke32 initializes SDL.
 * After videoSetMode(), SDL owns the backing dimensions (for example 640x400)
 * and the browser may scale that buffer to the mobile CSS box. Continuously
 * forcing it to the CSS dimensions invalidates SDL's software framebuffer.
 */
(function () {
  'use strict';
  var canvas = document.getElementById('canvas');
  if (!canvas) return;

  // Emscripten starts an unconfigured canvas at 300x150. Correct that default
  // once, before eduke32.js creates its SDL window. Never resize after that:
  // the SDL video mode must own the drawing buffer from then on.
  if (canvas.width !== 300 || canvas.height !== 150) return;

  function targetSize() {
    if (localStorage.getItem('e32_display') === 'fill') {
      return {
        width: Math.max(2, Math.floor(window.innerWidth || 300)),
        height: Math.max(2, Math.floor(window.innerHeight || 150))
      };
    }
    if (typeof window.renderBox === 'function') {
      var box = window.renderBox();
      return {
        width: Math.max(2, box.w | 0),
        height: Math.max(2, box.h | 0)
      };
    }
    var rect = canvas.getBoundingClientRect();
    return {
      width: Math.max(2, Math.floor(rect.width || window.innerWidth || 300)),
      height: Math.max(2, Math.floor(rect.height || window.innerHeight || 150))
    };
  }

  var size = targetSize();
  canvas.width = size.width;
  canvas.height = size.height;
  console.info('[mobile-canvas] initial drawing buffer set to ' +
    canvas.width + 'x' + canvas.height + '; SDL may resize it during video init');
})();
