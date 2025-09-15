#!/usr/bin/env pwsh
# Auto-update ngrok URL in .env.local

Write-Host "🚀 Starting ngrok and updating webhook URL..." -ForegroundColor Green

# Start ngrok in background
$ngrokJob = Start-Job -ScriptBlock { ngrok http 3000 }

# Wait for ngrok to start
Start-Sleep -Seconds 3

# Get the current ngrok URL
try {
    $response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -Method Get
    $ngrokUrl = $response.tunnels[0].public_url
    
    if ($ngrokUrl) {
        Write-Host "📡 New ngrok URL: $ngrokUrl" -ForegroundColor Cyan
        
        # Update .env.local file
        $envFile = ".env.local"
        $content = Get-Content $envFile -Raw
        
        # Replace webhook URLs
        $content = $content -replace "PLAID_WEBHOOK_URL=https://.*?\.ngrok-free\.app/api/aggregator/webhook", "PLAID_WEBHOOK_URL=$ngrokUrl/api/aggregator/webhook"
        $content = $content -replace "NEXT_PUBLIC_APP_URL=https://.*?\.ngrok-free\.app", "NEXT_PUBLIC_APP_URL=$ngrokUrl"
        
        # Write back to file
        $content | Set-Content $envFile
        
        Write-Host "✅ Updated .env.local with new ngrok URL" -ForegroundColor Green
        Write-Host "⚠️  Remember to update your Plaid Dashboard webhook to: $ngrokUrl/api/aggregator/webhook" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Could not get ngrok URL" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error getting ngrok URL: $_" -ForegroundColor Red
}

# Keep the script running
Write-Host "🔄 ngrok is running... Press Ctrl+C to stop" -ForegroundColor Blue
Wait-Job $ngrokJob
