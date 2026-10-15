#!/usr/bin/env python3
"""Add a reliable SDL video-mode fallback for the Emscripten browser build."""

from pathlib import Path

source_path = Path("source/build/src/sdlayer.cpp")
source = source_path.read_text(encoding="utf-8")

needle = """    SDL_CHECKFSMODES(maxx, maxy);

    // add windowed modes next
    // SDL sorts display modes largest to smallest, so we can just compare with mode 0
    // to make sure we aren't adding modes that are larger than the actual screen res
    SDL_GetDisplayMode(display, 0, &dispmode);
"""

replacement = """    SDL_CHECKFSMODES(maxx, maxy);

#ifdef __EMSCRIPTEN__
    // Some browser SDL backends report no discrete display modes. The caller
    // skips video initialization entirely when validmodecnt remains zero.
    if (validmodecnt == 0)
    {
        SDL_ADDMODE(640, 480, 8, 1);
        initprintf("Emscripten: SDL reported no display modes; using 640x480 fallback.\\\\n");
    }
#endif

    // add windowed modes next
    // SDL sorts display modes largest to smallest, so we can just compare with mode 0
    // to make sure we aren't adding modes that are larger than the actual screen res
    if (SDL_GetDisplayMode(display, 0, &dispmode) < 0 ||
        dispmode.w <= 0 || dispmode.h <= 0)
    {
        // Some browser video drivers have no mode zero to query.
        dispmode.w = maxx > 0 ? maxx : 640;
        dispmode.h = maxy > 0 ? maxy : 480;
    }
"""

if source.count(needle) != 1:
    raise SystemExit(
        "Expected exactly one SDL display-mode enumeration block; "
        f"found {source.count(needle)}. Refusing to patch an unknown source revision."
    )

source_path.write_text(source.replace(needle, replacement, 1), encoding="utf-8")
print("Applied Emscripten SDL display-mode fallback.")
