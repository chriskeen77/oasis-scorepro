"""Vault storage backends for the Second Brain nightly job.

Two backends expose the same interface so the rest of the tooling does not care
where the vault physically lives:

* ``LocalVault``  - the Drive folder mounted on disk (Google Drive for Desktop).
                    Used by the Windows Task Scheduler runner. No Google API setup.
* ``DriveVault``  - the Drive folder reached through the Google Drive API with a
                    service account. Used by the GitHub Actions (cloud) runner.

Unlike the read-only Drive MCP, the Drive *API* can update and rename files, so
the nightly job can edit MOCs in place.

Select a backend with the ``VAULT_MODE`` env var (``local`` or ``drive``).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


# Folder ids in Google Drive (the AI_Brain_Notes vault). Override via env if the
# vault is ever rebuilt.
FOLDERS = {
    "root": os.environ.get("VAULT_ROOT_ID", "1Jdy5ipFNb8JHykrAWKm1cdQehghSZPw0"),
    "system": os.environ.get("VAULT_SYSTEM_ID", "1EVOdHOPnD7OXWTxJOBvqEPAWiFczPYCU"),
    "templates": os.environ.get("VAULT_TEMPLATES_ID", "16Y1Wbr6SFQ0xjj4I3doI9VzS3BoxhYBq"),
    "inbox": os.environ.get("VAULT_INBOX_ID", "1vw_1b9HMkStULkc2AXgqnBcoABbBif1a"),
    "mocs": os.environ.get("VAULT_MOCS_ID", "1lB1FTtO1Bcb_dZd8DZtDE2b4lapawb-j"),
    "notes": os.environ.get("VAULT_NOTES_ID", "1txxRUL7wCzpIh-qc78eRTafi-vRSZO4S"),
}

# Sub-folder names as they appear on disk (LocalVault).
DIRS = {
    "system": "_System",
    "templates": "_Templates",
    "inbox": "00-Inbox",
    "mocs": "MOCs",
    "notes": "Notes",
}


@dataclass
class VaultFile:
    """A markdown file in the vault."""
    key: str          # path (local) or file id (drive) - opaque handle
    name: str         # filename incl. .md
    folder: str       # logical folder key: inbox|notes|mocs|...
    text: str


class Vault(Protocol):
    def list(self, folder: str) -> list[VaultFile]: ...
    def create(self, folder: str, name: str, text: str) -> VaultFile: ...
    def update(self, f: VaultFile, text: str) -> None: ...


# --------------------------------------------------------------------------- #
# Local backend (mounted Drive folder)
# --------------------------------------------------------------------------- #
class LocalVault:
    def __init__(self, root: str | None = None) -> None:
        root = root or os.environ.get("VAULT_DIR")
        if not root:
            raise SystemExit("Set VAULT_DIR to the mounted AI_Brain_Notes folder.")
        self.root = Path(root)
        if not self.root.exists():
            raise SystemExit(f"VAULT_DIR does not exist: {self.root}")

    def _dir(self, folder: str) -> Path:
        d = self.root / DIRS[folder]
        d.mkdir(parents=True, exist_ok=True)
        return d

    def list(self, folder: str) -> list[VaultFile]:
        out: list[VaultFile] = []
        for p in sorted(self._dir(folder).glob("*.md")):
            out.append(VaultFile(str(p), p.name, folder, p.read_text(encoding="utf-8")))
        return out

    def create(self, folder: str, name: str, text: str) -> VaultFile:
        p = self._dir(folder) / name
        # Never clobber: if a same-named note exists, suffix it.
        if p.exists():
            stem, suffix = p.stem, p.suffix
            i = 2
            while (self._dir(folder) / f"{stem} ({i}){suffix}").exists():
                i += 1
            p = self._dir(folder) / f"{stem} ({i}){suffix}"
        p.write_text(text, encoding="utf-8")
        return VaultFile(str(p), p.name, folder, text)

    def update(self, f: VaultFile, text: str) -> None:
        Path(f.key).write_text(text, encoding="utf-8")

    def delete(self, f: VaultFile) -> None:
        Path(f.key).unlink(missing_ok=True)


# --------------------------------------------------------------------------- #
# Drive API backend (cloud / service account)
# --------------------------------------------------------------------------- #
class DriveVault:
    MD = "text/markdown"

    def __init__(self) -> None:
        from google.oauth2 import service_account  # type: ignore
        from googleapiclient.discovery import build  # type: ignore

        creds_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
        if not creds_json:
            raise SystemExit("Set GOOGLE_SERVICE_ACCOUNT_JSON (the SA key JSON).")
        info = __import__("json").loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/drive"]
        )
        self.svc = build("drive", "v3", credentials=creds, cache_discovery=False)

    def list(self, folder: str) -> list[VaultFile]:
        from googleapiclient.http import MediaIoBaseDownload  # type: ignore
        import io

        q = f"'{FOLDERS[folder]}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'"
        files, token = [], None
        while True:
            resp = self.svc.files().list(
                q=q, fields="nextPageToken, files(id, name)", pageToken=token,
                supportsAllDrives=True, includeItemsFromAllDrives=True,
                corpora="allDrives",
            ).execute()
            for meta in resp.get("files", []):
                buf = io.BytesIO()
                dl = MediaIoBaseDownload(buf, self.svc.files().get_media(
                    fileId=meta["id"], supportsAllDrives=True))
                done = False
                while not done:
                    _, done = dl.next_chunk()
                files.append(VaultFile(meta["id"], meta["name"], folder,
                                       buf.getvalue().decode("utf-8", "replace")))
            token = resp.get("nextPageToken")
            if not token:
                break
        return files

    def create(self, folder: str, name: str, text: str) -> VaultFile:
        from googleapiclient.http import MediaInMemoryUpload  # type: ignore

        meta = {"name": name, "parents": [FOLDERS[folder]], "mimeType": self.MD}
        media = MediaInMemoryUpload(text.encode("utf-8"), mimetype=self.MD)
        f = self.svc.files().create(
            body=meta, media_body=media, fields="id, name",
            supportsAllDrives=True).execute()
        return VaultFile(f["id"], f["name"], folder, text)

    def update(self, f: VaultFile, text: str) -> None:
        from googleapiclient.http import MediaInMemoryUpload  # type: ignore

        media = MediaInMemoryUpload(text.encode("utf-8"), mimetype=self.MD)
        self.svc.files().update(
            fileId=f.key, media_body=media, supportsAllDrives=True).execute()

    def delete(self, f: VaultFile) -> None:
        # Trash rather than hard-delete, so nothing is ever truly lost.
        self.svc.files().update(
            fileId=f.key, body={"trashed": True}, supportsAllDrives=True).execute()


def get_vault() -> Vault:
    mode = os.environ.get("VAULT_MODE", "local").lower()
    return DriveVault() if mode == "drive" else LocalVault()
