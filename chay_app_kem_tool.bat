@echo off
chcp 65001 >nul
echo =====================================================================
echo    🚀 HỆ THỐNG TỰ ĐỘNG BÓC TÁCH KHI MỞ APP (AUTO-EXTRACTOR)
echo =====================================================================
echo.

:: 1. Khởi động Web Server Dashboard ở cửa sổ nền
start /min cmd /c "node server.js"

:: 2. Khởi động Trình theo dõi và tự động tiêm mã vào App
start /min cmd /c "node cdp_auto_injector.js"

echo [1/3] Đã bật Web Server Dashboard tại: http://localhost:3000
echo [2/3] Đã bật Trình tự động tìm kiếm web trong App (Port 9222)...
echo.
echo =====================================================================
echo HƯỚNG DẪN KHỞI ĐỘNG APP MỤC TIÊU:
echo =====================================================================
echo Nếu App của bạn là file .exe (Electron / WebView2 / Chromium / Chrome),
echo hãy đảm bảo App được chạy kèm tham số: --remote-debugging-port=9222
echo.
echo Ví dụ:
echo    "C:\Duong\Dan\Toi\AppCuaBan.exe" --remote-debugging-port=9222
echo =====================================================================
echo.
echo Đang mở giao diện Dashboard...
start http://localhost:3000
pause
