@echo off
REM Windows CI环境构建脚本

echo === 开始CI环境构建 ===
echo 平台: %1
echo Node版本: 
node --version
echo NPM版本: 
npm --version
echo 工作目录: 
cd

REM 设置环境变量
set NODE_OPTIONS=--max-old-space-size=4096

REM 构建渲染进程
echo === 构建渲染进程 ===
call npm run build:renderer

REM 构建主进程
echo === 构建主进程 ===
call npm run build:main

REM 根据平台选择构建目标
if "%1"=="win" (
    echo === 构建Windows应用 ===
    call npm run electron:build:win
) else if "%1"=="mac" (
    echo === 构建macOS应用 ===
    call npm run electron:build:mac
) else (
    echo === 构建通用应用 ===
    call npm run electron:build
)

echo === CI环境构建完成 ===
