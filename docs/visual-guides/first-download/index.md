# Your First Download

A first-time walkthrough of gdluxx, from creating the administrator account to
confirming that your first download completed successfully.

## 1. Create the Administrator Account

Open your gdluxx server in a browser. On a fresh installation, fill in the
username, email, and password fields, then select **Create account**.

<div style="text-align: center;">

![Create the administrator account](1-create-login.png){.screenshot}

</div>

## 2. Open the Version Page

Before starting a download, open **Settings > Version**. A fresh installation
won't yet have the gallery-dl binary. It will be reported as missing and that
its version is unknown.

<div style="text-align: center;">

![Version page before gallery-dl is installed](2-visit-version-page.png){.screenshot}

</div>

## 3. Check for Updates

Click **Check for Updates** to find the latest available gallery-dl version.
When gallery-dl is not installed, the page offers that version as an available
update.

<div style="text-align: center;">

![Latest gallery-dl version available to install](3-check-for-updates.png){.screenshot}

</div>

## 4. Install gallery-dl

Select **Update gallery-dl** to download and install the available version. When
the installation finishes, the current and latest version numbers match and a
success message confirms that gallery-dl is up to date.

<div style="text-align: center;">

![gallery-dl installed and up to date](4-update-gallery-dl.png){.screenshot}

</div>

## 5. Save the Example Configuration

Open **Configuration** from the sidebar. On a fresh installation, gdluxx loads
an example gallery-dl configuration. Review it, adjust any settings you want,
then select **Save** to create your configuration file.

<div style="text-align: center;">

![Example gallery-dl configuration ready to save](5-visit-config-page.png){.screenshot}

</div>

## 6. Start a Download

Return to **Home**, paste a supported URL into the **URL(s)** field, and review
the command preview. Select **Run** to start the download. You can enter
multiple URLs on separate lines or separated by spaces.

<div style="text-align: center;">

![URL entered on the Run page](6-enter-url.png){.screenshot}

</div>

## 7. Confirm the Download Completed

The job output opens as the download runs and lists each downloaded file. A
green **Success** status and an exit code of `0` confirm that the job completed
successfully. You can reopen this output later from the **Jobs** page.

<div style="text-align: center;">

![Successful job output with downloaded files](7-jobs-list.png){.screenshot}

</div>
