# First Run Setup

After installing, you need to create the first admin account.

### 1. Open the Web UI

Navigate to `http://<your-server-ip>:7755` or `https://my-cool-domain.com` if
using a reverse proxy. Since this is your first time, you'll be automatically
redirected to the setup page.

Until this first account is created, gdluxx has zero users, and anyone who can
reach the app can complete setup and claim it instead of you, so finish this
step right away rather than leaving the setup page open.

### 2. Create Admin User

Fill in the form with your desired email and password; click **Create Account**.
Your password must be at least 8 characters. This will be the only user account,
there's currently no multi-user support.

There's no email-based password reset. If you ever lose this password, see
[Recovering a Lost Admin Password](../advanced/data-recovery.md#recovering-a-lost-admin-password)
for the recovery procedure.

Sessions last 7 days with no sliding renewal, being active doesn't push the
expiry back, so periodic re-login is expected.

That's it. You're in. Now you can start using the application.
