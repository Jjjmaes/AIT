# 设置 Clash 代理（确保 Git 能连接 GitHub）
git config --global https.proxy http://127.0.0.1:7890

echo "=== 添加所有更改 ==="
git add .

echo "=== 提交更改 ==="
git commit -m "更新：完成 today 的开发内容"

echo "=== 推送到 GitHub ==="
git push
