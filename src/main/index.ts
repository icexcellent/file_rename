import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import Store from 'electron-store'
import { renameService, RenameOptions } from './services/renameService'
import { ocrService } from './services/ocrService'
import { systemCheckService } from './services/systemCheckService'

// 配置存储
const store = new Store()

// 设置默认配置
const defaultConfig = {
  deepseekApiKey: '',
  textExtractionLength: 2000,
  maxFileNameLength: 60,
  convertToLowercase: false,
  convertSpacesToUnderscores: false,
  imageFiles: true,
  pdfFiles: true,
  documentFiles: true,
}

// 确保配置存在
if (!store.has('config')) {
  store.set('config', defaultConfig)
}

// 开发环境判断
const isDev = process.env.IS_DEV === 'true'

// 主窗口实例
let mainWindow: BrowserWindow | null = null

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: '智能文件重命名工具',
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
  })

  // 加载应用
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
    // 开发模式下使用开发环境的preload脚本
    mainWindow.webContents.session.setPreloads([path.join(__dirname, 'preload.dev.js')])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 应用准备就绪
app.whenReady().then(async () => {
  // 初始化OCR服务
  try {
    await ocrService.initialize()
    console.log('OCR服务初始化成功')
  } catch (error) {
    console.error('OCR服务初始化失败:', error)
  }

  createWindow()

  // macOS 应用激活事件
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出应用
app.on('window-all-closed', async () => {
  // 释放OCR资源
  try {
    await ocrService.terminate()
  } catch (error) {
    console.error('释放OCR资源失败:', error)
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC 通信处理
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '所有支持的文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'pdf', 'docx', 'txt'] },
      { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] },
      { name: 'PDF文件', extensions: ['pdf'] },
      { name: '文档文件', extensions: ['docx', 'txt'] },
    ],
  })
  return result.filePaths
})

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  })
  return result.filePaths[0]
})

// 配置管理
ipcMain.handle('get-config', () => {
  return store.get('config', {})
})

ipcMain.handle('set-config', (_event, config) => {
  store.set('config', config)
  return true
})

// 文件重命名处理
ipcMain.handle('process-files', async (event, files: string[], options: RenameOptions) => {
  try {
    console.log(`[主进程] 开始处理文件重命名`)
    console.log(`[主进程] 文件数量: ${files.length}`)
    console.log(`[主进程] 配置选项:`, JSON.stringify(options, null, 2))
    console.log(`[主进程] DeepSeek API密钥: ${options.deepseekApiKey ? `${options.deepseekApiKey.substring(0, 8)}...` : '未配置'}`)
    
    // 发送日志到渲染进程
    event.sender.send('main-process-log', `[主进程] 开始处理文件重命名`)
    event.sender.send('main-process-log', `[主进程] 文件数量: ${files.length}`)
    event.sender.send('main-process-log', `[主进程] 配置选项: ${JSON.stringify(options, null, 2)}`)
    event.sender.send('main-process-log', `[主进程] DeepSeek API密钥: ${options.deepseekApiKey ? `${options.deepseekApiKey.substring(0, 8)}...` : '未配置'}`)
    
    // 限制并发数量为100
    if (files.length > 100) {
      throw new Error(`文件数量过多: ${files.length}，最多支持100个文件`)
    }

    const results = await renameService.startBatchRename(
      files,
      options,
      (progress) => {
        // 发送进度更新到渲染进程
        mainWindow?.webContents.send('progress-update', progress)
      },
      (result) => {
        // 发送结果更新到渲染进程
        mainWindow?.webContents.send('result-update', result)
      }
    )

    console.log(`[主进程] 重命名完成，结果:`, results)
    event.sender.send('main-process-log', `[主进程] 重命名完成，结果: ${JSON.stringify(results, null, 2)}`)

    return {
      success: true,
      results,
      message: `重命名完成，成功: ${results.filter(r => r.success).length}, 失败: ${results.filter(r => !r.success).length}`
    }
  } catch (error: any) {
    console.error('处理文件失败:', error)
    event.sender.send('main-process-log', `[主进程] 处理文件失败: ${error.message}`)
    return {
      success: false,
      error: error.message
    }
  }
})

// 获取重命名进度
ipcMain.handle('get-rename-progress', () => {
  return renameService.getCurrentProgress()
})

// 停止重命名
ipcMain.handle('stop-rename', () => {
  renameService.stopProcessing()
  return true
})

// 测试DeepSeek API
ipcMain.handle('test-deepseek-api', async (_event, apiKey: string) => {
  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      return { success: true, message: 'API连接成功' }
    } else {
      return { success: false, message: `API连接失败: ${response.status}` }
    }
  } catch (error: any) {
    return { success: false, message: `API连接失败: ${error.message}` }
  }
})

// 系统检查
ipcMain.handle('check-system', async (event) => {
  try {
    console.log('[主进程] 开始系统检查...')
    event.sender.send('main-process-log', '[主进程] 开始系统检查...')
    
    const systemInfo = await systemCheckService.getSystemInfo()
    console.log('[主进程] 系统信息:', systemInfo)
    event.sender.send('main-process-log', `[主进程] 系统信息: ${JSON.stringify(systemInfo, null, 2)}`)
    
    const dependencies = await systemCheckService.checkDependencies()
    console.log('[主进程] 依赖检查结果:', dependencies)
    event.sender.send('main-process-log', `[主进程] 依赖检查结果: ${JSON.stringify(dependencies, null, 2)}`)
    
    return {
      success: true,
      systemInfo,
      dependencies
    }
  } catch (error: any) {
    console.error('[主进程] 系统检查失败:', error)
    event.sender.send('main-process-log', `[主进程] 系统检查失败: ${error.message}`)
    return {
      success: false,
      error: error.message
    }
  }
})

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason, promise)
})
