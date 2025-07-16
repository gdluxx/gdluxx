# Common Errors

### "Permission Denied" on Startup

- **Symptom**: Container fails to start, logs show `permission denied`.
- **Cause**: You did not create the `./data` directory before starting the
  container. Docker created it as `root`.
- **Solution**:
  1.  ```bash
      docker compose down
      ```
  2.  ```bash
      sudo chown -R $USER:$USER data
      ```
  3.  ```bash
      docker compose up -d
      ```

### Job Fails Immediately

- **Symptom**: A job moves to the "Failed" list as soon as it's created.
- **Cause**: Usually an issue with the URL or your configuration.
- **Solution**:

  1.  **Check the job output**. The log will tell you what _gallery-dl_'s error
      was.
      - Click on the failed job in the Jobs page to see the detailed error
        message
  2.  **Check for _gallery-dl_ updates** in the Version Manager settings. The
      site you're targeting may require a newer version.
      - Sites frequently change their APIs, requiring gallery-dl updates
