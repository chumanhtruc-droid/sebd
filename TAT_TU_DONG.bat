@echo off
chcp 65001 >nul
title 🛑 TẮT HỆ THỐNG TỰ ĐỘNG BÓC TÁCH
cls

echo =====================================================================
echo    🛑 ĐANG TẮT PROXY & TRẢ LẠI MẠNG BÌNH THƯỜNG
echo =====================================================================
echo.

:: 1. Tắt Proxy Windows
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f >nul 2>&1

:: 2. Tắt các tiến trình server
taskkill /f /im node.exe >nul 2>&1

echo [OK] Đã tắt Proxy hệ thống thành công.
echo [OK] Đã dừng toàn bộ dịch vụ ngầm.
echo.
echo =====================================================================
echo    ✅ Máy tính của bạn đã trở lại trạng thái duyệt web ban đầu!
echo =====================================================================
echo.
pause
