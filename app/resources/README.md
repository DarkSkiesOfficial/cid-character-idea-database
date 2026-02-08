# Application Icons

Place the following icon files in this directory for proper packaging:

- **icon.png** - Used for Windows and Linux (minimum 512x512px, PNG format)
- **icon.icns** - Used for macOS (can be generated from PNG using online tools or `iconutil`)

## Generating macOS .icns from PNG

If you have a 1024x1024 PNG, you can generate the .icns file:

### Online Tools
- https://cloudconvert.com/png-to-icns
- https://anyconv.com/png-to-icns-converter/

### macOS Command Line
```bash
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
rm -rf icon.iconset
```

## Note

electron-builder will use default Electron icons if these files are missing. The app will still build successfully, but it's recommended to add custom icons for a professional appearance.
