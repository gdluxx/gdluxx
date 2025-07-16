# The Run Page

This is the main page for starting downloads.

### How to Use

1.  **URL(s) to process**: Paste one or more URLs here.
    - You can process multiple URLs at once by adding more than one
      - Space or new line delimited
2.  **Options**: Add any extra _gallery-dl_ options. These equivocate
    _gallery-dl_'s command-line flags (e.g., `--verbose`).

    - Use this to override or compliment your default config settings for this
      specific download
    - Common options: `--range 1-10` (limit to first 10 items), `--verbose`
      (verbose output), `--write-metadata` (save metadata files)

    ::: info  
    Some CLI options are not available due to _gdluxx_ having the ability to do
    what the option does. And some don't make since considering the Docker
    container environment.  
    :::

3.  **Run**: Click this to start the job.

After you click **Run**, a modal will popup to show the _first_ job output (if
you added multiple URLs)
