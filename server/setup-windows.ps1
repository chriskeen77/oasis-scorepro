# One-time setup for the TTS server on Windows.
# Run from the server\ directory in PowerShell:  .\setup-windows.ps1
# Requires Python 3.10-3.12 on PATH (3.11 recommended).

$ErrorActionPreference = "Stop"

Write-Host "Creating virtual environment..." -ForegroundColor Cyan
python -m venv .venv
& .\.venv\Scripts\Activate.ps1

Write-Host "Installing PyTorch (CUDA 12.8 build - required for RTX 5060 Ti)..." -ForegroundColor Cyan
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128

Write-Host "Installing server dependencies..." -ForegroundColor Cyan
pip install -r requirements.txt

# chatterbox-tts pins an older torch; force the cu128 build back afterwards.
Write-Host "Re-pinning PyTorch to the CUDA 12.8 build..." -ForegroundColor Cyan
pip install --force-reinstall torch torchaudio --index-url https://download.pytorch.org/whl/cu128

Write-Host ""
Write-Host "Verifying GPUs are visible to PyTorch:" -ForegroundColor Cyan
python -c "import torch; print('CUDA available:', torch.cuda.is_available()); [print(f'  cuda:{i} =', torch.cuda.get_device_name(i)) for i in range(torch.cuda.device_count())]"

Write-Host ""
Write-Host "Done. Start the server with:  .\start-server.ps1" -ForegroundColor Green
