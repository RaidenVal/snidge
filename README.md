# Snidge

A cross-platform desktop colour picker for graphic designers.

Press a hotkey to freeze the screen, sample any pixel with a magnifier loupe,
and get a radial palette of tint/shade variants in HEX / RGB / HSL — then export
it as a PNG. Built with Electron, React and TypeScript.

## How to use

1. Press the shortcut (default `Ctrl+Alt+J`, changeable in Settings) from
   anywhere on your desktop.
2. Your screen freezes; click the exact pixel you want to sample.
3. Choose **Palette** mode to turn that one colour into a radial set of
   tint/shade variants, or **Gradient** mode to sample a second colour and
   blend between the two.
4. Click any swatch to see its HEX, RGB and CMYK values — one click copies
   any of them to your clipboard.
5. Not happy with the result? **Repick** samples again; **Cancel** starts
   over. **Save** exports the whole palette or gradient as a PNG.

## Privacy

Snidge runs entirely on your device. It makes no internet connections, sends no
data anywhere, and contains no analytics or telemetry.

Everything happens locally:

- It briefly captures your screen so you can sample a pixel's colour. That
  screenshot is held in memory only — never saved, never transmitted.
- It saves a palette PNG only when you choose to, to a location you pick.
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
