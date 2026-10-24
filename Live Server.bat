@echo off
setlocal
cd /d "%~dp0"
title IDF Map - Serveur local
set "IDF_NODE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined IDF_NODE set "IDF_NODE=%%N"
if not defined IDF_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "IDF_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined IDF_NODE (
  echo Node.js est introuvable. Installez Node.js puis relancez ce fichier.
  pause
  exit /b 1
)
if /i "%~1"=="start" goto start
if /i "%~1"=="stop" goto stop
:menu
cls
echo IDF Map - Test du site en local
echo.
"%IDF_NODE%" "%~dp0scripts\local-live-server.cjs" status
echo.
echo 1. Lancer le serveur et ouvrir Chrome
echo 2. Arreter le serveur
echo 3. Fermer cette fenetre
echo.
choice /c 123 /n /m "Votre choix : "
if errorlevel 3 exit /b 0
if errorlevel 2 goto stop
:start
"%IDF_NODE%" "%~dp0scripts\local-live-server.cjs" start
goto done
:stop
"%IDF_NODE%" "%~dp0scripts\local-live-server.cjs" stop
:done
if not "%~1"=="" exit /b %errorlevel%
echo.
pause
goto menu
