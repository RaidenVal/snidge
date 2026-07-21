# Snidge

A cross-platform desktop colour picker for graphic designers.

Snidge opens with two tools: **Colour Palette** turns a sampled screen colour
into a radial set of lighter and darker tones, while **Colour Gradient** blends
between two colours. Inspect and copy HEX, RGB and CMYK values, then export the
result as a PNG. Built with Electron, React and TypeScript.

## How to use

1. Open Snidge and choose **Colour Palette** or **Colour Gradient** from the
   main interface.
2. In **Colour Palette**, start colour capture and click any pixel on your
   screen. Snidge generates 6, 10 or 20 lighter and darker tones.
3. In **Colour Gradient**, capture Colour A and Colour B, then generate 4, 9
   or 16 colours between them.
4. Click any colour to inspect its HEX, RGB and CMYK values and copy the value
   you need.
5. Use **Repick** to capture another colour, **Cancel** to reset the current
   result, or **Save** to export the palette or gradient as a PNG.

The default quick-capture shortcut is `Ctrl+Alt+S` on Windows
(`Command+Option+S` on macOS) and can be changed in Settings.

## Privacy

Snidge runs entirely on your device. It makes no internet connections, sends no
data anywhere, and contains no analytics or telemetry.

Everything happens locally:

- It briefly captures your screen so you can sample a pixel's colour. That
  screenshot is held in memory only — never saved, never transmitted.
- It saves a palette or gradient PNG only when you choose to, to a location
  you pick.
- It stores your chosen keyboard shortcut in a small local settings file.

Snidge collects no personal data. Because nothing leaves your device, there is
no personal-data processing under GDPR.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [Oxc](https://marketplace.visualstudio.com/items?itemName=oxc.oxc-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Checks

```bash
$ npm run lint
$ npm run format:check
$ npm run typecheck
$ npm test
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## License

Copyright 2026 RaidenVal. Licensed under the [Apache License 2.0](LICENSE).
Third-party component licenses are listed in [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt).
