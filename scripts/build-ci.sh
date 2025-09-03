#!/bin/bash

# CI环境构建脚本
set -e

echo "=== 开始CI环境构建 ==="
echo "平台: $1"
echo "Node版本: $(node --version)"
echo "NPM版本: $(npm --version)"
echo "工作目录: $(pwd)"

# 设置环境变量
export NODE_OPTIONS="--max-old-space-size=4096"

# 构建渲染进程
echo "=== 构建渲染进程 ==="
npm run build:renderer

# 构建主进程
echo "=== 构建主进程 ==="
npm run build:main

# 根据平台选择构建目标
case "$1" in
  "mac")
    echo "=== 构建macOS应用 ==="
    npm run electron:build:mac
    ;;
  "win")
    echo "=== 构建Windows应用 ==="
    npm run electron:build:win
    ;;
  *)
    echo "=== 构建通用应用 ==="
    npm run electron:build
    ;;
esac

echo "=== CI环境构建完成 ==="
