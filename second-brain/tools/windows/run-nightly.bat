@echo off
REM Second Brain nightly job - local (Windows) runner.
REM Edit the two paths below, then import SecondBrain-Nightly.xml into Task
REM Scheduler (or point a task at this .bat) to run it at 3am.

REM 1) Folder containing the tools (this repo's second-brain\tools):
set TOOLS_DIR=C:\path\to\oasis-scorepro\second-brain\tools

REM 2) Your virtualenv python (recommended) or just "python":
set PY=python

cd /d "%TOOLS_DIR%"

REM Load .env if present (KEY=VALUE per line).
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" set "%%a=%%b"
  )
)

REM Local mode writes straight into the mounted Drive vault (set VAULT_DIR in .env).
set VAULT_MODE=local

"%PY%" nightly.py >> nightly.log 2>&1
