@echo off
setlocal
cd /d "%~dp0"
node --test tests/domain.test.ts tests/http.test.ts
if errorlevel 1 exit /b 1
python -m unittest discover -s tests -p "test_*.py" -v
if errorlevel 1 exit /b 1
echo Las dos suites terminaron correctamente.
pause
