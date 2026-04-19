# Icons

Tauri bundle requires `icon.ico` in this directory to build the Windows installer. Not committed yet — placeholder step before the first production build.

**To generate**: use [tauricon](https://github.com/tauri-apps/tauri-icon) or the built-in Tauri CLI:

```bash
# From the repo root, with a source PNG at least 1024x1024:
npm run tauri icon -- path/to/source.png
```

This produces `icon.ico`, `icon.icns`, and multiple `.png` sizes. The `.ico` is what the NSIS installer uses on Windows.

For development runs (`npm run tauri dev`) without an icon, Tauri will substitute a default.
