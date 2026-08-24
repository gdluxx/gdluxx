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

That's it, no other directives are required.

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
buffers responses, that will stall or chunk the live output stream even though
Caddy itself is configured correctly.

## Set `ORIGIN`

Set the `ORIGIN` environment variable to whatever hostname you're proxying, or
form submissions and browser-extension requests will fail:

```
ORIGIN=https://gdluxx.example.com
```

See `.env.example` for the full explanation of `ORIGIN`.

## Trusted Proxy Header {#trusted-proxy-header}

gdluxx rate-limits login attempts. By default it trusts **no forwarding
header**, so a directly-exposed instance can't be tricked by a spoofed/rotated
`X-Forwarded-For` into bypassing the limiter, with no trusted header configured,
gdluxx reads no client IP at all and throttles every login attempt through one
shared global bucket. That's a safe default, and it's fine for a single-user
self-host even behind a proxy.

Set `TRUSTED_PROXY_HEADER` only if a reverse proxy sits in front of gdluxx
**and** that proxy sets a trustworthy client-IP header, one it overwrites
itself rather than passing through unchanged from the incoming request. Name
that header to key the limiter per client IP instead of the shared global
bucket:

```
TRUSTED_PROXY_HEADER=x-forwarded-for
```

Caddy and Traefik overwrite or sanitize `X-Forwarded-For` by default rather than
appending to a client-supplied value. Nginx does **not**: the common
`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` recipe appends to
whatever the client sent, leaving the attacker in control of the first entry.
Before trusting the header behind Nginx, configure it to overwrite:

```nginx
proxy_set_header X-Forwarded-For $remote_addr;
```

::: danger  
Do **not** set `TRUSTED_PROXY_HEADER` on a directly-exposed instance (no proxy
in front of gdluxx). Doing so lets anyone reach gdluxx directly and set that
header themselves, re-opening the spoofing bypass the default is there to
prevent.  
:::

See `.env.example` for the full explanation.
