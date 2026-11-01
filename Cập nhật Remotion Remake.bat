@echo off
chcp 65001 >nul
rem git pull may rewrite this very file, so the update runs from a copy in %TEMP%.
if /i not "%~1"=="--tu-ban-sao" (
  copy /y "%~f0" "%TEMP%\remotion-remake-update.bat" >nul
  "%TEMP%\remotion-remake-update.bat" --tu-ban-sao "%~dp0"
)
title Cập nhật Remotion Remake
set "ROOT=%~2"
cd /d "%ROOT%" || goto :fail

where git >nul 2>nul
if errorlevel 1 (
  echo [!] Máy chưa có Git. Cài tại https://git-scm.com rồi bấm lại nút này.
  goto :fail
)

netstat -ano | findstr /r /c:":3210 .*LISTENING" >nul
if not errorlevel 1 (
  echo [!] App đang chạy. Hãy đóng cửa sổ "Remotion Remake" trước, rồi bấm lại nút cập nhật.
  goto :fail
)

for /f "delims=" %%b in ('git branch --show-current') do set "BRANCH=%%b"
if /i not "%BRANCH%"=="main" (
  echo Đang chuyển về nhánh main...
  git switch main
  if errorlevel 1 goto :fail
)

for /f "delims=" %%h in ('git rev-parse HEAD') do set "OLD=%%h"
echo Đang lấy thay đổi từ GitHub...
git pull --ff-only origin main
if errorlevel 1 (
  echo.
  echo [!] Không cập nhật được: trên máy có thay đổi chưa lưu, hoặc lịch sử khác với GitHub.
  echo     Chạy "git status" trong thư mục này để xem, hoặc nhờ Claude xử lý giúp.
  goto :fail
)
for /f "delims=" %%h in ('git rev-parse HEAD') do set "NEW=%%h"

if "%OLD%"=="%NEW%" (
  echo.
  echo App đã là bản mới nhất.
  goto :done
)

echo.
echo Các thay đổi mới:
git --no-pager log --first-parent --format="  - %%s" %OLD%..%NEW%
echo (Chi tiết: CHANGELOG.md)

cd /d "%ROOT%remotion-remake" || goto :fail
git diff --quiet %OLD% %NEW% -- package.json package-lock.json
if errorlevel 1 set "NEED_INSTALL=1"
if not exist "node_modules\" set "NEED_INSTALL=1"
if defined NEED_INSTALL (
  echo.
  echo Thư viện đã thay đổi: đang cài lại...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :fail
)
if not exist ".venv\" (
  call npm run setup
  if errorlevel 1 goto :fail
)

:done
echo.
echo Xong!
choice /c CK /n /t 60 /d K /m "Mở app ngay bây giờ? [C = có, K = không] "
if errorlevel 2 exit /b 0
start "" "%ROOT%Khởi động Remotion Remake.bat"
exit /b 0

:fail
echo.
echo Cập nhật chưa xong. Đọc thông báo ở trên, rồi nhấn phím bất kỳ để đóng.
pause >nul
exit /b 1
