# PEAP Project - Start All Services
# Run this script from the PEAP-main directory

$root = "c:\Users\msi\Documents\PEAP-main"

Write-Host "=== Starting PEAP Services ===" -ForegroundColor Cyan
Write-Host ""

# --- API Gateway (port 8010) ---
Write-Host "[1/5] Starting API Gateway on port 8010..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  Set-Location '$root\services\api-gateway';
  & '.venv\Scripts\python.exe' -m uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
" -WindowStyle Normal

Start-Sleep -Seconds 2

# --- Matching Service (port 8002) ---
Write-Host "[2/5] Starting Matching Service on port 8002..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  Set-Location '$root\services\matching-service';
  & '.venv\Scripts\python.exe' -m uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
" -WindowStyle Normal

Start-Sleep -Seconds 2

# --- Search Service (port 8003) ---
Write-Host "[3/5] Starting Search Service on port 8003..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  Set-Location '$root\services\search-service';
  & 'D:\PEAP-venvs\search-service\Scripts\python.exe' -m uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload
" -WindowStyle Normal

Start-Sleep -Seconds 2

# --- Parsing Service (port 8001) ---
Write-Host "[4/5] Starting Parsing Service on port 8001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  Set-Location '$root\services\parsing-service';
  & 'D:\PEAP-venvs\parsing-service\Scripts\python.exe' -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
" -WindowStyle Normal

Start-Sleep -Seconds 2

# --- Frontend (port 5173) ---
Write-Host "[5/5] Starting Frontend on port 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  Set-Location '$root\apps\peap-frontend-main';
  npm run dev
" -WindowStyle Normal

Write-Host ""
Write-Host "=== All services launched! ===" -ForegroundColor Green
Write-Host ""
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "  Frontend:         http://localhost:5173" -ForegroundColor White
Write-Host "  API Gateway:      http://localhost:8010/docs" -ForegroundColor White
Write-Host "  Matching Service: http://localhost:8002/docs" -ForegroundColor White
Write-Host "  Search Service:   http://localhost:8003/docs" -ForegroundColor White
Write-Host "  Parsing Service:  http://localhost:8001/docs" -ForegroundColor White
Write-Host "  Elasticsearch:    http://localhost:9200" -ForegroundColor White
Write-Host "  Kafka UI:         http://localhost:8080" -ForegroundColor White
Write-Host ""
Write-Host "Demo login (frontend):" -ForegroundColor Cyan
Write-Host "  Candidate:  candidate@matchcore.demo  (any password)" -ForegroundColor White
Write-Host "  Company:    provider@matchcore.demo   (any password)" -ForegroundColor White
Write-Host "  Advisor:    advisor@matchcore.demo    (any password)" -ForegroundColor White
