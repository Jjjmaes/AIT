# 测试用户注册
Write-Host "测试用户注册..."
$registerBody = @{
    username = "testuser123"
    email = "test123@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" -Method Post -ContentType "application/json" -Body $registerBody
    Write-Host "注册响应:"
    $registerResponse | ConvertTo-Json
} catch {
    Write-Host "注册失败:"
    Write-Host $_.Exception.Response.StatusCode.Value__
    Write-Host $_.Exception.Response.StatusDescription
}

# 测试用户登录
Write-Host "`n测试用户登录..."
$loginBody = @{
    email = "test123@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    Write-Host "登录响应:"
    $loginResponse | ConvertTo-Json

    # 保存 token
    $token = $loginResponse.token
    Write-Host "`n获取到的 token: $token"

    # 测试获取用户资料
    Write-Host "`n测试获取用户资料..."
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $profileResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/users/profile" -Method Get -Headers $headers
    Write-Host "用户资料响应:"
    $profileResponse | ConvertTo-Json
} catch {
    Write-Host "请求失败:"
    Write-Host $_.Exception.Response.StatusCode.Value__
    Write-Host $_.Exception.Response.StatusDescription
    Write-Host $_.Exception.Message
} 