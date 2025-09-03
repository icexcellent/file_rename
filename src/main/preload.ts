import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件选择
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  // 配置管理
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config: any) => ipcRenderer.invoke('set-config', config),
  
  // 文件处理
  processFiles: (files: string[], options: any) => 
    ipcRenderer.invoke('process-files', files, options),
  
  // 重命名控制
  getRenameProgress: () => ipcRenderer.invoke('get-rename-progress'),
  stopRename: () => ipcRenderer.invoke('stop-rename'),
  
  // API测试
  testDeepSeekAPI: (apiKey: string) => ipcRenderer.invoke('test-deepseek-api', apiKey),
  
  // 系统检查
  checkSystem: () => ipcRenderer.invoke('check-system'),
  
  // 进度更新
  onProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('progress-update', (_event, progress) => callback(progress))
  },
  
  // 结果更新
  onResult: (callback: (result: any) => void) => {
    ipcRenderer.on('result-update', (_event, result) => callback(result))
  },
  
  // 错误处理
  onError: (callback: (error: any) => void) => {
    ipcRenderer.on('error-update', (_event, error) => callback(error))
  },
  
  // 移除监听器
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
})

// 类型声明
declare global {
  interface Window {
    electronAPI: {
      selectFiles: () => Promise<string[]>
      selectDirectory: () => Promise<string>
      getConfig: () => Promise<any>
      setConfig: (config: any) => Promise<boolean>
      processFiles: (files: string[], options: any) => Promise<any>
      getRenameProgress: () => Promise<any>
      stopRename: () => Promise<boolean>
      testDeepSeekAPI: (apiKey: string) => Promise<any>
      checkSystem: () => Promise<any>
      onProgress: (callback: (progress: any) => void) => void
      onResult: (callback: (result: any) => void) => void
      onError: (callback: (error: any) => void) => void
      removeAllListeners: (channel: string) => void
    }
  }
}
