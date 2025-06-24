# gdluxx

gdluxx is nothing more than a browser based gui for _gallery-dl_

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
     - [ ] Migrate API key generation to _better-auth_

2. Modal

   - [x] Combine JobList and JobListModal components
   - [ ] Fix ConfirmModal not picking up keyboard focus
   - [ ] Add delete confirm modal for individual job deletion

3. Docs

   - [ ] Build documentation
   - [ ] Tie in _gallery-dl_ docs

4. Misc
   - [ ] Consolidate SVG icons
   - [ ] Consider alternatives to deprecated `document.execCommand('copy')`
   - [x] Combine `JobList` components
   - [ ] Adjust `api-keys.json` file permissions
   - [ ] Consolidate notification system
   - [ ] Add CLI options
   - [ ] Prevent `Run` action when _gallery-dl_ isn't available

## Installation

### Requirements

- Node.js 18+
- pnpm

### Steps

1. Clone the repository
2.
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Rename `.env.example` to `.env` and generate `AUTH_SECRET`

5. Start the development server:
   ```bash
   pnpm dev
   ```
6. Open your browser to `http://localhost:5173`

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
