@echo off
chcp 65001 >nul
title ⚡ AUTO QUESTION EXTRACTOR - HỆ THỐNG BÓC TÁCH TỰ ĐỘNG 100%
cls

echo =====================================================================
echo    🚀 ĐANG BẬT CHẾ ĐỘ TỰ ĐỘNG BÓC TÁCH 100% (ZERO-CLICK)
echo =====================================================================
echo.

:: 1. Bật Proxy toàn hệ thống Windows tự động
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer /t REG_SZ /d "127.0.0.1:8080" /f >nul 2>&1

:: 2. Khởi động Proxy Server & Dashboard ngầm
start /min "Auto Proxy Server" cmd /c "node app.js"

echo [OK] Đã tự động kết nối Proxy hệ thống (127.0.0.1:8080)
echo [OK] Đã bật Server Dashboard ngầm (http://localhost:3000)
echo.
echo =====================================================================
echo    🎉 ĐÃ XONG! BẠN CHỈ CẦN MỞ WEB BÌNH THƯỜNG:
echo =====================================================================
echo  - Bạn cứ mở Chrome/Edge lướt vào bất kỳ trang web bài thi nào.
echo  - Tool sẽ TỰ ĐỘNG bóc toàn bộ câu hỏi và đáp án ngầm 100%.
echo  - KHÔNG CẦN DÁN LINK, KHÔNG CẦN MỞ F12, KHÔNG CẦN BẤM GÌ.
echo =====================================================================
echo.
echo Đang mở giao diện Dashboard để bạn theo dõi câu hỏi...
start http://localhost:3000

echo.
echo (Khi nào dùng xong, hãy nhấp đúp vào file TAT_TU_DONG.bat để tắt)
echo.
pause
