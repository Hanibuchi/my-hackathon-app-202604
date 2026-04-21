@echo off
chcp 65001 > nul
echo.
echo  GeoMind Companion - 起動中...
echo.

if not exist .env (
    echo  [ERROR] .env ファイルが見つかりません。
    echo  .env.example をコピーして .env を作成し、APIキーを設定してください。
    echo.
    pause
    exit /b 1
)

echo  ブラウザで http://localhost:3000 を開いてください
echo  停止するには Ctrl+C を押してください
echo.
python server.py
pause
