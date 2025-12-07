# Jobs List

The Jobs page shows everything about your downloads such as what's running,
what's done, and what went wrong.

## Job Status

### Running

Jobs currently in progress. You'll see:

- The job's status
- Real-time output if you click to view it

### Completed

A job will show completed with a status of Success, Skipped, and/or Error

#### Success

Successfully finished downloads. Each shows:

- **Success count**: Number of files downloaded
- **Skipped count**: Number of files that were skipped
- **Error count**: Number of files that weren't downloaded due to an error

::: info  
A job showing "5 success, 1 failed" means the job completed but ran into issues
with one file. That's not a complete failure since the job still succeeded
overall.  
:::

#### Skipped

Any URL that is skipped due to gallery-dl having a record of it being previously
downloaded

### Error

Jobs that failed completely (gallery-dl didn't even run, permissions issue,
etc.)

## Reading Job Statistics

Each job displays success/failed counts. Here's what they mean:

- **"5 successes"** = 5 files downloaded successfully
- **"1 failed"** = 1 file attempted but failed
- **"0 failed"** = Perfect run, everything worked

A job with "100 successes, 2 failed" is still a successful job overall but ran
into issues on 2 items.

## Interacting with Jobs

### View Full Output

1. Click on any job
2. A modal appears showing the complete job output
3. Useful for seeing:
   - What files were downloaded
   - Why specific files failed
   - Debugging messages if something went wrong
4. Output is limited to the most recent 10,000 lines
5. Close the modal to return to the list

::: info  
No more and no less info is shown than what gallery-dl provides. The output is
piped directly from gallery-dl  
:::

### Delete a Job

1. Click the trash/delete icon on a job (from the output modal or job list)
2. Confirm you want to delete it
3. The job is removed from the list (files already downloaded stay on your disk)

### Batch Delete

1. Check the toggle next to one or more jobs
2. A 'Delete Selected' button appears
3. Click it to delete the selected jobs
4. Confirm

### Delete All Jobs

There's a "Delete All" option to clear your entire job history at once. Use with
caution since it can't be reversed.

::: info  
Deleting a job using any method will never delete any downloaded files. There is
no way to delete anything from your filesystem using gdluxx.  
:::

## Sorting Jobs

You can sort your job list by:

- **Date** (newest or oldest first) (this is default)
- **Status** (completed, failed, running)
- **Success/Failure count** (most successful first, etc.)

## Filtering Jobs

You can also filter by clicking the cards at the top of the job list

- **Running** All running jobs
- **Success** Jobs that were overall a success
- **Skips** Jobs that were skipped because gallery-dl already has a record of
  the URL
- **Errors** These are jobs that errored for some reason

## Understanding Job Output

When you view a job's output, you see the raw gallery-dl output. It looks
something like:

```shell
Process started with PID: 1376969
gallery-dl: Unsupported URL 'https://www.example.com/unsupported-url'
```

- this job will show as an error in the job list

---

```shell
Process started with PID: 1981369
/path/to/saved/image.jpg
✔ /path/to/saved/image.jpg
# /path/to/saved/image-2.jpg
```

- The check mark denotes a successful download (it will also be highlighted
  green)
- The pound indicates a skipped job (it will bea gray color)
- This job will show as a success (there will be indication of a skipped
  download)

## Troubleshooting via Job Output

### If a job failed completely

1. Click the job in the **Error** tab
2. View its output
3. Look for error messages (usually in red or marked ERROR)
4. Common issues:
   - Site requires authentication
   - URL was invalid
   - Network connection issue

### If a job partially failed

1. View the job output
2. Look for specific items that failed
3. Try re-downloading just those URLs with different options
4. Check if the site requires authentication or has rate limits

::: tip  
You can re-run the URL with the `--verbose` option to get more info  
:::
