# Start the TTS backend.  Run from the server\ directory:  .\start-server.ps1
$ErrorActionPreference = "Stop"
& .\.venv\Scripts\Activate.ps1
python main.py
