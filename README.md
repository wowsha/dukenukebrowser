# Duke Nukem 3D — Browser + Mobile

A browser-first, touchscreen-friendly Duke Nukem 3D port for **GitHub Pages**. It builds on [EDuke32-WASM](https://github.com/DigitalCyberSoft/eduke32-wasm), an EDuke32 WebAssembly port with the free 1.3D shareware episode bundled by its upstream build.

**Play:** https://wowsha.github.io/dukenukebrowser/  
**Engine:** EDuke32 + Emscripten/WebAssembly  
**Local build tools required:** None. GitHub Actions builds and publishes the site.

## Mobile controls

On phones and tablets, an on-screen HUD appears automatically:

- **Left stick:** move forward/back; move sideways to strafe.
- **Drag the right side:** turn / look.
- **FIRE:** Ctrl · **USE:** Space · **JUMP:** A · **DUCK:** Z · **RUN:** Shift · **NEXT:** ].

The controls are a lightweight browser layer around the engine: the upstream engine and game assets are not edited by the mobile-controls script. Desktop keyboard and mouse input remains available.

## Deployment

The `.github/workflows/pages.yml` workflow checks out the upstream engine at a pinned commit, validates the upstream shareware package checksum, installs the Emscripten toolchain on a GitHub-hosted runner, builds WebAssembly, adds the mobile UI, and deploys the generated static site to GitHub Pages. You do not need to install Emscripten, Node, or any build tools.

The first workflow run may take several minutes. Open the **Actions** tab to see its result. If GitHub Pages is not provisioned automatically, go to **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**; no source compilation or command-line work is needed.

## Game data and licenses

- Only the **Duke Nukem 3D 1.3D shareware episode** is included; no retail/Atomic Edition assets are included.
- The upstream shareware files and their original `LICENSE.TXT` are used unchanged. The license permits free online services to distribute the game subject to its terms; read [the deployed shareware license](https://wowsha.github.io/dukenukebrowser/SHAREWARE-LICENSE.TXT).
- The engine is [EDuke32](https://www.eduke32.com/), distributed under the licenses in its upstream source tree. This project deploys the upstream engine without changing its C/C++ source; the exact upstream revision built by CI is [37b56eefaf8125eaa853c417512019cc7ad94b81](https://github.com/DigitalCyberSoft/eduke32-wasm/tree/37b56eefaf8125eaa853c417512019cc7ad94b81).
- The touch-control wrapper in this repository is MIT-licensed (see the header in `mobile-controls.js`).

Duke Nukem 3D and related names are trademarks of their respective owners. This is an unofficial fan port and is not affiliated with or endorsed by 3D Realms.
