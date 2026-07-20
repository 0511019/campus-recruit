@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   校招t望台 - 数据抓取
echo ========================================
echo.
C:\Users\Lenovo\AppData\Local\Programs\Python\Python312\python.exe scraper\scraper.py
echo.
echo 按任意键退出...
pause >nul
