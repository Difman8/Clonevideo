@echo off
chcp 65001 >nul
title Remotion Remake
cd /d "%~dp0remotion-remake" || goto :fail

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Máy chưa có Node.js. Hãy cài bản LTS tại https://nodejs.org rồi bấm lại nút này.
  start "" https://nodejs.org
  goto :fail
)

if not exist "node_modules\" (
  echo Lần chạy đầu: đang cài thư viện, mất vài phút...
  call npm install
  if errorlevel 1 goto :fail
)

if not exist ".venv\" (
  echo Đang cài yt-dlp và trình duyệt render...
  call npm run setup
  if errorlevel 1 goto :fail
)

echo.
echo Đang khởi động... trình duyệt sẽ tự mở http://localhost:3210
echo Giữ cửa sổ này mở trong lúc dùng app. Đóng cửa sổ này để tắt app.
echo.
set OPEN_BROWSER=1
call npm start
if errorlevel 1 goto :fail
exit /b 0

:fail
echo.
echo Có lỗi xảy ra. Đọc thông báo ở trên, rồi nhấn phím bất kỳ để đóng.
pause >nul
exit /b 1
