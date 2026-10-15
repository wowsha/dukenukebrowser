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

# Keep the whole potential yielding call chain Asyncify-instrumented. Excluding
# C_ParseCommand(bool) can leave a null rewind target if game startup reaches a
# browser yield through a script callback.
makefile_path = Path("Common.mak")
makefile = makefile_path.read_text(encoding="utf-8")
old_asyncify_block = """        # EDuke32's software renderer has deep call chains with large stack-allocated
        # locals; the Emscripten default 64KB stack is too small. Give it a real
        # stack. C_ParseCommand recurses per CON nesting level; keep it off the
        # Asyncify stack so its deep recursion is not instrumented.
        LINKERFLAGS += -sSTACK_SIZE=16MB -sINITIAL_MEMORY=256MB -sASYNCIFY_REMOVE='C_ParseCommand(bool)'
"""
new_asyncify_block = """        # EDuke32's software renderer has deep call chains with large stack-allocated
        # locals; the Emscripten default 64KB stack is too small. Give it a real
        # stack. Keep potentially yielding call chains fully instrumented so
        # Asyncify can safely rewind through startup and script callbacks.
        LINKERFLAGS += -sSTACK_SIZE=16MB -sINITIAL_MEMORY=256MB
"""
if makefile.count(old_asyncify_block) != 1:
    raise SystemExit(
        "Expected exactly one Asyncify remove-list block in Common.mak; "
        f"found {makefile.count(old_asyncify_block)}. Refusing to patch an unknown source revision."
    )

makefile_path.write_text(makefile.replace(old_asyncify_block, new_asyncify_block, 1), encoding="utf-8")
print("Removed the unsafe Asyncify exclusion for C_ParseCommand(bool).")

# Disable SDL's implicit browser yields: the engine explicitly yields from
# videoShowFrame() and handleevents(), so SDL must not start a nested Asyncify
# rewind from inside its own surface-present/event-polling calls.
init_needle = """    int32_t err = 0;

    if (SDL_WasInit(SDL_INIT_VIDEO) != SDL_INIT_VIDEO)
        err = SDL_InitSubSystem(SDL_INIT_VIDEO);
"""
init_replacement = """    int32_t err = 0;

#ifdef __EMSCRIPTEN__
    SDL_SetHint(SDL_HINT_EMSCRIPTEN_ASYNCIFY, "0");
#endif

    if (SDL_WasInit(SDL_INIT_VIDEO) != SDL_INIT_VIDEO)
        err = SDL_InitSubSystem(SDL_INIT_VIDEO);
"""
sdlayer = source_path.read_text(encoding="utf-8")
if sdlayer.count(init_needle) != 1:
    raise SystemExit(
        "Expected exactly one SDL video initialization block; "
        f"found {sdlayer.count(init_needle)}. Refusing to patch an unknown source revision."
    )
source_path.write_text(sdlayer.replace(init_needle, init_replacement, 1), encoding="utf-8")
print("Disabled SDL implicit Asyncify yields before SDL video initialization.")
