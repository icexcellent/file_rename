@echo off
REM Windows CI环境构建脚本
setlocal enabledelayedexpansion

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
echo NODE_OPTIONS设置为: %NODE_OPTIONS%

REM 设置错误处理
set ERROR_COUNT=0

REM 构建渲染进程
echo === 构建渲染进程 ===
call npm run build:renderer
if %ERRORLEVEL% neq 0 (
    echo 渲染进程构建失败
    set /a ERROR_COUNT+=1
)

REM 构建主进程
echo === 构建主进程 ===
call npm run build:main
if %ERRORLEVEL% neq 0 (
    echo 主进程构建失败
    set /a ERROR_COUNT+=1
)

REM 构建Electron应用
if "%1"=="win" (
    echo === 构建Windows应用 ===
    call npm run electron:build:win
    if %ERRORLEVEL% neq 0 (
        echo Windows应用构建失败
        set /a ERROR_COUNT+=1
    )
) else (
    echo === 构建通用应用 ===
    call npm run electron:build
    if %ERRORLEVEL% neq 0 (
        echo 通用应用构建失败
        set /a ERROR_COUNT+=1
    )
)

if %ERROR_COUNT% gtr 0 (
    echo === CI环境构建完成，但有错误 ===
    echo 错误数量: %ERROR_COUNT%
    exit /b 1
) else (
    echo === CI环境构建完成 ===
    exit /b 0
)
