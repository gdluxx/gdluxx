---
layout: doc
---

# gdluxx

gdluxx is nothing more than a self-hosted browser based gui for
[_gallery-dl_](https://github.com/mikf/gallery-dl).

It gives you a simple web interface to manage downloads, edit your configuration
file, and monitor jobs without touching the command line.

### 30,000 foot view

- **GUI** An interface for _gallery-dl_ to act upon one or more URLs. Paste
  links into a web page instead of typing commands.
- **Config file editor**: Built-in JSON editor to create/modify your
  configuration file. The editor provides visual indicators when syntax errors
  are present.
- **See What's Happening**: View active and past jobs. "Running", "Error", and
  "Completed" indicators.
- **Updater**: Download _gallery-dl_ and keep it updated without leaving the
  app.
- **Browser Extension Support**: Companion browser extension that sends the
  current tab's URL to _gdluxx_. You don't even have to return to the app to
  download the galleries.
- **Fully Self Contained**: Privacy oriented, there are no unwanted outbound
  calls to "phone home", retrieve fonts, stylesheets, icons, etc. The only time
  _gdluxx_ reaches out to the internet is when **YOU** initiate it.

### Why?

I started with just being curious if it was possible. Once it was working, I
thought that if I could have a browser extension to send the URL to the app,
that would be quite the timesaver. It's grown from there. I know it doesn't seem
like much on the surface, but it's been a lot of effort to get to this point.

Also, I'm a badge wearing [DataHoarder](https://www.reddit.com/r/DataHoarder/).

::: info  
There are probably edge cases I can't even dream up. Let me know if you're having issues and I will try to 
assist.

Feedback of all sorts is welcome!  
:::