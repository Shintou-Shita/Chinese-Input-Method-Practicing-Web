#!/bin/sh
cd "$(dirname "$0")"
echo "服务器已启动: http://localhost:8000"
node server.js
