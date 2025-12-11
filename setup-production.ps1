# 🚀 快速設定腳本 - 完成 Render 部署後執行

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerURL
)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  JUMBO Bridge - 生產環境配置腳本" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 檢查 URL 格式
if ($ServerURL -notmatch '^https://') {
    Write-Host "❌ 錯誤：伺服器 URL 必須以 https:// 開頭" -ForegroundColor Red
    Write-Host "   範例：https://jumbo-bridge-server.onrender.com" -ForegroundColor Yellow
    exit 1
}

# 創建 .env.production 文件
$envContent = "# 生產環境配置`nVITE_SERVER_URL=$ServerURL"
Set-Content -Path ".env.production" -Value $envContent -Encoding UTF8

Write-Host "✅ 已創建 .env.production 文件" -ForegroundColor Green
Write-Host "   伺服器 URL: $ServerURL" -ForegroundColor White
Write-Host ""

# 重新構建
Write-Host "📦 開始構建生產版本..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 構建成功！" -ForegroundColor Green
    Write-Host ""
    
    # 提交到 Git
    Write-Host "📝 準備提交更改..." -ForegroundColor Cyan
    git add .env.production
    git commit -m "config: Add production server URL from Render.com"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 已提交更改" -ForegroundColor Green
        Write-Host ""
        Write-Host "🚀 準備推送到 GitHub..." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   執行以下命令來部署：" -ForegroundColor Yellow
        Write-Host "   git push origin master" -ForegroundColor White
        Write-Host ""
        
        $push = Read-Host "是否現在推送到 GitHub? (y/n)"
        if ($push -eq 'y' -or $push -eq 'Y') {
            git push origin master
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "==================================================" -ForegroundColor Green
                Write-Host "  🎉 部署完成！" -ForegroundColor Green
                Write-Host "==================================================" -ForegroundColor Green
                Write-Host ""
                Write-Host "等待 2-3 分鐘讓 GitHub Actions 完成部署後，" -ForegroundColor White
                Write-Host "訪問您的網站：" -ForegroundColor White
                Write-Host "https://你的用戶名.github.io/JUMBO-Bridge/" -ForegroundColor Cyan
                Write-Host ""
                Write-Host "⚠️ 首次訪問可能需要 30-60 秒喚醒 Render 伺服器" -ForegroundColor Yellow
                Write-Host ""
            }
        }
    }
} else {
    Write-Host "❌ 構建失敗！請檢查錯誤訊息" -ForegroundColor Red
    exit 1
}
