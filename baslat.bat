@echo off
cd /d "%~dp0"
echo Sunucu baslatiliyor... Bu pencereyi kapatirsan uygulama da kapanir.
echo Tarayicida http://localhost:5000 adresini ac.
python app.py
pause
