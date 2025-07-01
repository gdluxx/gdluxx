# gdluxx

gdluxx is nothing more than a self-hosted browser based gui for
[_gallery-dl_](https://github.com/mikf/gallery-dl)

[See some screenshots](#screenshots)

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

## Installation

Only Docker installation is supported. It is absolutely required that you create
the bind mount directory BEFORE creating the container. Otherwise, you will run
into startup issues due to permissions. The container will not update the
directory permissions for you. The user in the container is `1000:1000`, not
root.

For example, if you want everything in the container (downloads, configuration
file, etc.) to end up at `~Documents/gdluxx/`, you'll need to create
`~Documents/gdluxx/`. If you want everything located in the same directory from
where you run the Docker compose command, you'll need to make sure you create
the `data/` directory FIRST.

If you try to use a Docker volume, you won't have easy access to your downloads.

You can find the official documentation regarding Docker bind mounts
[here](https://docs.docker.com/get-started/workshop/06_bind_mounts/).

You'll also want to copy over the `.env.example` file as `.env` to reside with
your compose file. It is very important that you generate your `AUTH_SECRET`.
The easiest way to do that is using `openssl rand -hex 32` in your terminal.
Apologies to Windows users, I don't know much about it these days. I found
https://www.cryptool.org/en/cto/openssl/, and it allowed me to run the `openssl`
command, perhaps this will work for you.

I'm still working through some issues with setting `HOST` and `PORT`, so to use
this application currently, leave them as they are.

```yaml
name: gdluxx

services:
  gdluxx:
    image: ghcr.io/gdluxx/gdluxx:latest
    container_name: gdluxx
    user: '1000:1000'
    ports:
      - '7755:7755'
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=${PORT}
      - HOST=${HOST}
      - AUTH_SECRET=${AUTH_SECRET}
    restart: unless-stopped
```

## Configuration

gdluxx will use the `data/` directory to store:

- `gdluxx.db` - For storing authentication credentials, jobs data, API keys, and
  _gallery-dl_ version info
- `config.json` - Your _gallery-dl_ configuration
- `gallery-dl.bin` - _gallery-dl_ binary file
- _gallery-dl_ downloads

## Screenshots

<p align="center">
 <img src="screenshots/screenshot_1.png" alt="Screenshot 1" width="400"/>  
 <img src="screenshots/screenshot_2.png" alt="Screenshot 2" width="400"/>  
 <img src="screenshots/screenshot_3.png" alt="Screenshot 3" width="400"/>  
 <img src="screenshots/screenshot_4.png" alt="Screenshot 4" width="400"/>  
 <img src="screenshots/screenshot_5.png" alt="Screenshot 5" width="400"/>  
 <img src="screenshots/screenshot_6.png" alt="Screenshot 6" width="400"/>
</p>

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
   - [x] Add delete confirm modal for individual job deletion
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
