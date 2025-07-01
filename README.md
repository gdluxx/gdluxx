# gdluxx

gdluxx is nothing more than a self-hosted browser based gui for
[_gallery-dl_](https://github.com/mikf/gallery-dl)

## What's it about?

- **GUI**: An interface for _gallery-dl_ to act upon one or more URLs
- **Configuration Editor**: Built-in JSON editor to create/modify your
  configuration file
  - Includes syntax highlighting and validation to ensure there are no errors
- **Browser Extension Support** An endpoint for receiving URLs from the
  companion browser extension
  - API key management for secure external access
- **Real-time Updates**: Job monitoring with live output streaming
- **Job Queue Management**: View running, completed, and failed downloads with
  output
- **Version Management**: Download and update _gallery-dl_ from the browser

## TODO

1. Auth

   - [x] Add authentication
     - [x] Add internal key authentication for internal endpoints
     - [x] Implement RESTful approach to deleting API keys (instead of POST)
     - [ ] Add OIDC support
     - [x] Migrate API key generation to _better-auth_

2. UX/UI

   - [x] Combine JobList and JobListModal components
   - [x] Fix ConfirmModal not picking up keyboard focus
   - [ ] Add delete confirm modal for individual job deletion
   - [x] Fix spacing for <Info> modal in /config for "Loaded example"

3. Docs

   - [ ] Build documentation
   - [ ] Tie in _gallery-dl_ docs

4. Misc

   - [ ] Consolidate SVG icons
   - [ ] Consider alternatives to deprecated `document.execCommand('copy')`
   - [x] Combine `JobList` components
   - [x] ~~Adjust `api-keys.json` file permissions~~
   - [ ] Consolidate notification system
   - [ ] Add CLI options
   - [ ] Prevent `Run` action when _gallery-dl_ isn't available

5. Incorporate _gallery-dl_ optional dependencies

   - [ ] yt-dlp or youtube-dl: HLS/DASH video downloads, ytdl integration
   - [ ] FFmpeg: Pixiv Ugoira conversion
   - [ ] mkvmerge: Accurate Ugoira frame timecodes
   - [ ] PySocks: SOCKS proxy support
   - [ ] brotli or brotlicffi: Brotli compression support
   - [ ] zstandard: Zstandard compression support
   - [ ] PyYAML: YAML configuration file support
   - [ ] toml: TOML configuration file support for Python<3.11
   - [ ] SecretStorage: GNOME keyring passwords for --cookies-from-browser
   - [ ] Psycopg: PostgreSQL archive support
   - [ ] truststore: Native system certificate stores

## Installation

### Requirements

- Node.js 18+
- pnpm

### Steps

1. Clone the repository

2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Rename `.env.example` to `.env` and generate `AUTH_SECRET`

4. Start the development server:
   ```bash
   pnpm dev
   ```
5. Open your browser to `http://localhost:5173`

## Building for Production

```bash
pnpm build
pnpm preview
```

## Configuration

gdluxx will create a `data/` directory to store:

- `gdluxx.db` - For managing authentication
- `config.json` - Your _gallery-dl_ configuration
- `jobs.json` - Job history and status
- `api-keys.json` - API keys for external access
- `logging.json` - Debug logging settings
- `version.json` - _gallery-dl_ version information
- `gallery-dl.bin` - _gallery-dl_ binary file

## API Usage

If you have interest in using the API endpoint outside the companion browser
extension, create an API key in the settings, then send POST requests to
`/api/extension/external`:

```json
{
  "urlToProcess": "https://example.com/image-gallery",
  "apiKey": "your-api-key-here"
}
```

## What's in a name?

gdluxx is pronounced `jee dee luks`

It's a combination of _gallery-dl_ and deluxe
