# Installation

Only Docker installation is supported.

### Quick Start

:::danger ⚠️ **Critical: Directory Permissions** ⚠️ You **MUST** create the bind
mount directory (`data`) before starting the container. The container runs as
user `1000:1000`, not root, and _cannot modify host directory permissions_ for
you.

If you skip step 1, Docker will create the directory as `root`, and the
container will fail to start with permission errors.  
:::

::: tip Custom paths: Want your data elsewhere?

Create the directory first:

```bash
mkdir -p ~/Documents/gdluxx
```

Then update your compose `volumes` to: `- ~/Documents/gdluxx:/app/data`  
:::

1.  ⚠️ Create the data directory first ⚠️

    ```bash
    mkdir data
    ```

2.  Copy environment file.

    ```bash
    cp .env.example .env
    ```

3.  Generate your `AUTH_SECRET`. (<small>[Windows Note](#windows-note)</small>)

    ```bash
    openssl rand -hex 32
    ```

4.  Paste your generated `AUTH_SECRET` into your `.env` file.

    ```bash
    AUTH_SECRET=your-super-secret-auth-key-change-this
    ```

5.  Create a `docker-compose.yml` file.

    ```yaml
    name: gdluxx

    services:
      gdluxx:
        image: ghcr.io/gdluxx/gdluxx:latest
        container_name: gdluxx
        ports:
          - '7755:7755'
        volumes:
          - ./data:/app/data
        environment:
          - AUTH_SECRET=${AUTH_SECRET}
        restart: unless-stopped
        deploy:
          restart_policy:
            condition: on-failure
            max_attempts: 3
            delay: 3s
    ```

6.  Run `docker compose up -d`.

    ```bash
    docker compose up -d
    ```

{#windows-note}

:::info Windows Users  
If you are on Windows, you may not have `openssl`. You can use the Windows
Subsystem for Linux (WSL), Git Bash, or an alternative tool like
[CryptoTool's OpenSSL](https://www.cryptool.org/en/cto/openssl/) to generate the
secret.

Also, I know nothing about Windows these days. I've never used WSL, Git Bash, or
Docker on Windows. Unfortunately, I won't be able to assist with troubleshooting
any issues that may arise.

This also means I've not tested any of this on Windows.  
:::
