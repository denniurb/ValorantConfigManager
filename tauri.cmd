@echo off
rem Startet "npm run tauri <args>" in der VS 2022 Build-Tools-Umgebung.
rem (Die VS-18-Installation auf diesem PC hat keine vollstaendigen C++-Libs/Header.)
rem Beispiele:  tauri.cmd dev     tauri.cmd build
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul 2>nul || exit /b 1
cd /d "%~dp0"
npm run tauri -- %*
