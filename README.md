# CID — Character Idea Database

A desktop app for organizing, browsing, and managing creative character ideas. Built for writers, artists, game designers, and anyone who collects character concepts.

Store character profiles with images, notes, tags, groups, and custom fields — then browse them through multiple visual modes.

---

## How to Install

### Windows
- **Installer:** Run **`Character Idea Database Setup 0.1.0.exe`** and follow the prompts
- **Portable:** Run the portable `.exe` directly — no installation needed

### macOS
- **DMG:** Open the `.dmg` file and drag to Applications folder
- **ZIP:** Extract and run the app

### Linux
- **AppImage:** Make executable (`chmod +x`) and run — works on all distributions
- **DEB:** Install with `sudo dpkg -i character-idea-database_0.1.0_amd64.deb` (Debian/Ubuntu/Mint)

---

## Features

**Organization**
- Tags, groups, and custom fields for flexible categorization
- Priority levels and status tracking (waiting, active, archived)
- Multiple libraries — keep separate collections with independent databases
- Bulk operations — multi-select with Ctrl/Shift click, batch tag/group/move/delete

**Browsing Modes**
- **Grid** — masonry layout with card previews and density slider

![Grid View](https://i.postimg.cc/hvhMg9Z1/image-2026-02-08-080950967.png)

- **Cover Flow** — 3D carousel for visual browsing

![Cover Flow](https://i.postimg.cc/rmwNC1kZ/image-2026-02-08-081103910.png)

- **Slideshow** — fullscreen auto-advancing presentation

![Slideshow](https://i.postimg.cc/SxbLtF4z/image-2026-02-08-081202499.png)

- **Swipe** — card swiping for quick decisions

![Swipe](https://i.postimg.cc/zvRW0pPk/image-2026-02-08-081252463.png)

- **Tournament** — bracket-style character comparison

![Tournament Mode](https://i.postimg.cc/8zbyRPvp/image-2026-02-08-081335771.png)

**Character Detail**
- Image gallery with lightbox and zoom
- Inline editing for all fields
- Markdown rendering for seed text and notes
- Duplicate image detection

![Character Detail](https://i.postimg.cc/bJ4LyZ76/image-2026-02-08-081408361.png)

**Workflow**
- Pull characters into active work, return to shelf, or archive
- Import/export individual characters or full libraries as .zip files
- Word cloud extraction from seed text for discovering tags

---

## For Developers

If you want to run from source or contribute:

```
cd app
npm install
npm run dev
```

Requires [Node.js](https://nodejs.org/) 18+.

To build distributables:
```bash
cd app
npm run package        # Windows (NSIS installer + portable)
npm run package:mac    # macOS (DMG + ZIP)
npm run package:linux  # Linux (AppImage + DEB)
npm run package:all    # All platforms
```

**Note:** RPM packages are not built by default. To enable RPM building, add `rpm` to the `linux.target` array in `electron-builder.yml` and install `rpm` package on your build system.

---

## License

[MIT](LICENSE) — DarkSkies
