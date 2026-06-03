# Snidge

A cross-platform desktop colour picker for graphic designers.

Press a hotkey to freeze the screen, sample any pixel with a magnifier loupe,
and get a radial palette of tint/shade variants in HEX / RGB / HSL — then export
it as a PNG. Built with Electron, React and TypeScript.

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

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
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
