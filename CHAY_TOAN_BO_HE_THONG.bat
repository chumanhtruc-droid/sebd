@echo off
chcp 65001 >nul
title HỆ THỐNG TỰ ĐỘNG BÓC TÁCH & CLOUD REVERSE PROXY
cls

echo =====================================================================
echo    🚀 ĐANG KHỞI ĐỘNG TOÀN BỘ HỆ THỐNG (1-CLICK STARTUP)
echo =====================================================================
echo.

:: 1. Tắt các tiến trình node cũ nếu có xung đột cổng
taskkill /f /im node.exe >nul 2>&1

:: 2. Khởi động Cloud Reverse Proxy & Dashboard Server (Port 3000)
echo [1/2] Đang khởi động Cloud Reverse Proxy & Dashboard Server (Port 3000)...
start /min "Cloud Proxy Server" cmd /c "node server.js"
timeout /t 2 /nobreak >nul

:: 3. Khởi động Test Server mẫu (Port 5000)
echo [2/2] Đang khởi động Website Đề Thi Mẫu (Port 5000)...
start /min "Test Exam Server" cmd /c "node test/test_server.js"
timeout /t 1 /nobreak >nul

echo.
echo =====================================================================
echo    ✅ TOÀN BỘ HỆ THỐNG ĐÃ SẴN SÀNG!
echo =====================================================================
echo  - Giao diện Dashboard Quản lý : http://localhost:3000
echo  - Link Reverse Proxy Tự động  : http://localhost:3000/proxy?url=http://127.0.0.1:5000
echo =====================================================================
echo.
echo Đang tự động mở trình duyệt...

:: 4. Tự động mở Dashboard và trang Test đã được tiêm mã trên trình duyệt
start http://localhost:3000
start http://localhost:3000/proxy?url=http://127.0.0.1:5000

echo.
echo (Cửa sổ này có thể đóng lại bất cứ lúc nào mà không làm tắt server)
echo.
pause
