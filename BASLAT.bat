@echo off
setlocal
cd /d "%~dp0"
title Naberlo Stadium Studio
where node >nul 2>nul
if errorlevel 1 (
  echo Once Node.js 24 veya daha yeni LTS surumunu kur.
  echo Kurulumdan sonra bu dosyaya tekrar cift tikla.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)
node scripts\start-local.mjs
if errorlevel 1 (
  echo.
  echo Program baslatilamadi. Yukaridaki hata mesajini kontrol et.
)
pause
