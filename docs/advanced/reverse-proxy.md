# Reverse Proxy Guide

::: danger  
For best security, you should never expose a service to the internet.  
:::

Refer to documentation for your respective reverse proxy. You shouldn't need to
do anything special. Below is the bare minimum Caddy configuration I use.

## Minimal Caddyfile

gdluxx listens on port `7755` by default (see `docker-compose.yml` /
`Dockerfile`). Point a hostname at it:

```
gdluxx.example.com {
    reverse_proxy localhost:7755
}
```

That's it — no other directives are required.

## Live job output (SSE)

gdluxx streams live job output to the browser over Server-Sent Events
(`src/routes/api/command/stream`). Caddy's `reverse_proxy` streams responses by
default, so SSE works out of the box with the config above. If you'd like to be
explicit about it, set `flush_interval -1`, which disables Caddy's response
buffering delay entirely:

```
gdluxx.example.com {
    reverse_proxy localhost:7755 {
        flush_interval -1
    }
}
```

Whatever you do, don't put another proxy or load balancer in front of Caddy that
buffers responses — that will stall or chunk the live output stream even though
Caddy itself is configured correctly.

## Set `ORIGIN`

Set the `ORIGIN` environment variable to whatever hostname you're proxying, or
form submissions and browser-extension requests will fail:

```
ORIGIN=https://gdluxx.example.com
```

See `.env.example` for the full explanation of `ORIGIN`.
