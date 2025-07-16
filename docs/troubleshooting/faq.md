# FAQ

### How do I update gdluxx?

This refers to updating the gdluxx application, not _gallery-dl_ itself.

```bash
# Pull the latest Docker image
docker compose pull

# Recreate the container
docker compose up -d
```

### Where are my downloaded files?

Inside the `./data` directory you created. The exact subfolder depends on your
_gallery-dl_ config. If you haven't changed it, _gallery-dl_ usually creates
folders based on the site and author/gallery name. Regardless, unless you did
something special, anything downloaded should be in the `downloads/` directory.

### Why bind mounts instead of Docker volumes?

Bind mounts give you direct file access on the host system. It makes managing
your downloads and configs simpler than if they were hidden inside a Docker
volume or the container itself.

### Can I use Podman?

Probably, I've never used it myself. Use `podman-compose` with the same
`docker-compose.yml`. Just remember to create the `data` directory with the
right permissions first, same as with Docker.
