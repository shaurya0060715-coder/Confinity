# Confinity

Confinity is a developer-focused Electron browser in Beta. It provides a fast, extensible browsing experience with built-in support for Chrome Web Store extensions, developer tools, and custom extension loading.

## Table of Contents

- [About](#about)
- [Features](#features)
- [Screenshots](#screenshots)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Running from Source](#running-from-source)
- [Usage](#usage)
- [Development](#development)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License](#license)
- [Contact](#contact)

## About

Confinity is an Electron-based browser built for developers. It offers a lightweight, customizable alternative to standard browsers with built-in extension support, developer workflows, and performance optimization. The project is actively in Beta, so expect updates and refinements.

> NOTE: This project is in Beta. Expect breaking changes, incomplete features, and bugs. Contributions and issue reports are appreciated.

## Features

- **Electron-based** — cross-platform support (Windows, macOS, Linux)
- **Chrome Web Store integration** — install extensions directly from the Chrome Web Store
- **Custom extension support** — load unpacked extensions for development and testing
- **Developer-friendly** — built with developers in mind
- **Frameless window** — modern, custom UI with native title bar controls
- **Extension management** — install, remove, and manage extensions seamlessly
- **Cache management** — clear browser cache with ease

## Screenshots

![Confinity UI](./Confinity.png)

## Getting Started

Follow these instructions to run Confinity from source.

### Prerequisites

- **Node.js** (v18 or higher) and **npm**
- **Git**
- **Windows** (currently configured for Windows NSIS installer)

### Running from Source

1. Clone the repository

   ```bash
   git clone https://github.com/shaurya0060715-coder/Confinity.git
   cd Confinity
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Start the application in development mode

   ```bash
   npm start
   ```

The browser will launch with support for Chrome Web Store extensions and unpacked extensions.

## Usage

- **Install extensions from Chrome Web Store** — use the Confinity UI to add extensions directly
- **Load unpacked extensions** — load local extension folders for development
- **Manage extensions** — remove or disable extensions via the extensions menu
- **Custom UI** — use the frameless window with integrated title bar controls
- **Clear cache** — quickly clear browser cache from the settings

## Development

Guidance for contributors and maintainers:

- Follow the existing code style and structure
- Main entry point: `main.js` (Electron main process)
- UI: `index.html`, `style.css`, `script.js`
- Extension management is handled via IPC (Inter-Process Communication)
- Create feature branches named `feat/<short-description>` or `fix/<issue-number>`
- Test extension loading and management before submitting PRs

## Building an Installer

To create a Windows NSIS installer:

```bash
npm run dist
```

The installer will be generated in the `dist/` folder with desktop shortcuts and installation options.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`feat/<description>` or `fix/<issue-number>`)
3. Commit changes with descriptive messages
4. Open a Pull Request describing the change and why it's needed

## Roadmap

Planned improvements:

- Stable release (v1.0)
- macOS and Linux support
- Performance improvements and memory profiling
- Advanced extension settings and permissions UI
- Sync and account features
- Built-in developer tools improvements

## License

This project currently has no license file. Consider adding one (e.g., MIT, Apache-2.0) to define usage terms.

## Contact

Maintainer: [shaurya0060715-coder](https://github.com/shaurya0060715-coder)

For issues or feature requests, please open an issue on the repository: https://github.com/shaurya0060715-coder/Confinity/issues
