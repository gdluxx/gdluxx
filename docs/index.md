---
layout: doc
---

# gdluxx

gdluxx is nothing more than a self-hosted browser based gui for
[_gallery-dl_](https://github.com/mikf/gallery-dl).

It gives you a simple web interface to manage downloads, edit your configuration
file, and monitor jobs without touching the command line.

### Features

- **GUI**: Paste one or more URLs to download. No CLI
- **Batch Processing**: Submit multiple URLs at once.
- **Site Rules**: Automatically apply specific gallery-dl options based on URL
  patterns.
- **Config Editor**: Built-in JSON editor with syntax highlighting, validation,
  and file upload support.
- **Keyword Info**: Test what metadata is available for supported sites.
- **Themes**: Some different themes to choose, light and dark modes.
- **Job Management**: Track running, completed, and failed jobs.
- **Browser Extension**: Send URLs directly from your browser. Available for
  both Chrome and Firefox.
- **Overlay UI**: Extension provides an overlay for sending URLs without leaving
  your current page.
- **API Access**: Endpoint available if you want to write your own scripts.
  - Yes, I understand you don't need gdluxx for this.
- **Version Management**: Update the gallery-dl binary from the app.
- **Self-Contained**: No external dependencies for fonts, styles, or icons.
  There are no external calls to the internet except when you explicitly request
  it.

### Why?

I started with just being curious if it was possible. Once it was working, I
thought that if I could have a browser extension to send the URL to the app,
that would be quite the timesaver. It's grown from there. I know it doesn't seem
like much on the surface, but it's been a lot of effort to get to this point.

Also, I'm a badge wearing [DataHoarder](https://www.reddit.com/r/DataHoarder/).

::: info  
There are probably edge cases I can't even dream up. Let me know if you're
having issues and I will try to assist.

Feedback of all sorts is welcome!  
:::
