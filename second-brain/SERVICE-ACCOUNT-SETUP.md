# Google service account setup (for the cloud nightly job)

The GitHub Actions job runs in the cloud, so it can't use your logged-in Google
Drive for Desktop. It authenticates as a **service account** — a robot Google
identity — that you grant access to the vault's Shared Drive. ~10 minutes, once.

> **Why this works cleanly here:** your vault lives on a **Shared Drive**
> (root `0AN4R0HdHnd_1Uk9PVA`). Files on a Shared Drive are owned by the drive,
> not by a person, so a service account can create/edit them with no storage
> quota of its own. (On personal "My Drive" a service account can't own files —
> another reason the Shared Drive is the right home.)

## 1. Create / pick a Google Cloud project

1. Go to <https://console.cloud.google.com> and sign in as `chriskeen77@gmail.com`.
2. Top bar → project picker → **New Project** (e.g. name it `second-brain`) →
   **Create**, then make sure it's the selected project.

## 2. Enable the Drive API

1. Left menu → **APIs & Services → Library**.
2. Search **Google Drive API** → open it → **Enable**.

## 3. Create the service account

1. Left menu → **IAM & Admin → Service Accounts** → **Create service account**.
2. Name: `second-brain-nightly` → **Create and continue**.
3. **Skip** the "grant this service account access to project" step (we grant
   access by *sharing the Drive*, not via IAM roles) → **Done**.
4. You'll land on the Service Accounts list. Copy the new account's **email** —
   it looks like `second-brain-nightly@second-brain-xxxxx.iam.gserviceaccount.com`.

## 4. Create a JSON key

1. Click the service account → **Keys** tab → **Add key → Create new key**.
2. Choose **JSON** → **Create**. A `.json` file downloads. **Keep it secret** —
   this is the robot's password. Don't commit it or email it.

## 5. Share the Shared Drive with the service account

1. Open **Google Drive** → left sidebar → **Shared drives** → open the drive that
   contains `AI_Brain_Notes/`.
2. Click the drive name (top) → **Manage members** (or the *people* icon).
3. Paste the service account **email** from step 3, set role to
   **Content manager**, uncheck "Notify people", → **Send / Share**.

> If `AI_Brain_Notes` ever turns out to be in *My Drive* instead, share the
> **folder** itself with the service-account email as **Editor**.

## 6. Add the GitHub secret

1. In the repo: **Settings → Secrets and variables → Actions → New repository
   secret**.
2. Name: `GOOGLE_SERVICE_ACCOUNT_JSON`. Value: **paste the entire contents** of the
   JSON key file (the whole `{ ... }`, multiline is fine). → **Add secret**.
3. While here, also add: `KEEP_EMAIL`, `KEEP_MASTER_TOKEN` (see `CAPTURE.md`), and
   optionally `ANTHROPIC_API_KEY`.

## 7. Test it

1. Repo → **Actions** tab → **Second Brain nightly** → **Run workflow** →
   tick **Preview without writing** (dry run) → **Run**.
2. Open the run logs → the **Run nightly librarian** step. You should see it list
   notes it *would* create. No errors = Drive auth works.
3. Re-run without dry-run (or just wait for 3am Central) to let it write for real.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `403 ... insufficientFilePermissions` / nothing found | The SA isn't a member of the Shared Drive (redo step 5), or wrong drive. |
| `Drive API has not been used/enabled` | Enable the Drive API in the **same project** the key belongs to (step 2). |
| `File not found` for folder ids | The vault was rebuilt with new ids — set `VAULT_*_ID` env/secrets to match. |
| Auth works but writes nothing | It may not be 3am Central (the `--guard-central-3am` flag). Use the manual dry-run/real run to test on demand. |

## Security notes

- The JSON key lives **only** in GitHub Secrets; `tools/.gitignore` blocks
  `service-account*.json` and `.env` from ever being committed.
- The SA can touch **only** the Shared Drive you shared with it — nothing else in
  your Google account.
- If a key is ever exposed, delete it under the service account's **Keys** tab and
  create a new one.
