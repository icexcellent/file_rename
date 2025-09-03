import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs-extra'

const execAsync = promisify(exec)

export interface SystemInfo {
  platform: string
  arch: string
  nodeVersion: string
  npmVersion: string
  workingDirectory: string
}

export interface DependencyStatus {
  name: string
  available: boolean
  version?: string
  error?: string
  path?: string
}

export class SystemCheckService {
  /**
   * 获取系统基本信息
   */
  async getSystemInfo(): Promise<SystemInfo> {
    try {
      const npmVersion = await this.getNpmVersion()
      
      return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        npmVersion,
        workingDirectory: process.cwd()
      }
    } catch (error) {
      console.error('[系统检查] 获取系统信息失败:', error)
      throw error
    }
  }

  /**
   * 检查系统依赖
   */
  async checkDependencies(): Promise<DependencyStatus[]> {
    const results: DependencyStatus[] = []
    
    try {
      console.log('[系统检查] 开始检查系统依赖...')
      
      // 检查GraphicsMagick
      results.push(await this.checkGraphicsMagick())
      
      // 检查Ghostscript
      results.push(await this.checkGhostscript())
      
      // 检查Tesseract数据文件
      results.push(await this.checkTesseractData())
      
      // 检查Sharp
      results.push(await this.checkSharp())
      
      // 检查PDF-lib
      results.push(await this.checkPdfLib())
      
      console.log('[系统检查] 系统依赖检查完成')
      return results
      
    } catch (error) {
      console.error('[系统检查] 系统依赖检查失败:', error)
      throw error
    }
  }

  /**
   * 检查GraphicsMagick
   */
  private async checkGraphicsMagick(): Promise<DependencyStatus> {
    try {
      console.log('[系统检查] 检查GraphicsMagick...')
      
      if (process.platform === 'win32') {
        // Windows上检查gm命令
        const { stdout } = await execAsync('gm version')
        const version = stdout.trim().split('\n')[0]
        console.log('[系统检查] GraphicsMagick可用:', version)
        return {
          name: 'GraphicsMagick',
          available: true,
          version,
          path: 'gm'
        }
      } else {
        // macOS/Linux上检查convert命令
        const { stdout } = await execAsync('convert -version')
        const version = stdout.trim().split('\n')[0]
        console.log('[系统检查] GraphicsMagick可用:', version)
        return {
          name: 'GraphicsMagick',
          available: true,
          version,
          path: 'convert'
        }
      }
    } catch (error: any) {
      console.log('[系统检查] GraphicsMagick不可用:', error.message)
      return {
        name: 'GraphicsMagick',
        available: false,
        error: error.message
      }
    }
  }

  /**
   * 检查Ghostscript
   */
  private async checkGhostscript(): Promise<DependencyStatus> {
    try {
      console.log('[系统检查] 检查Ghostscript...')
      
      const { stdout } = await execAsync('gs --version')
      const version = stdout.trim()
      console.log('[系统检查] Ghostscript可用:', version)
      
      return {
        name: 'Ghostscript',
        available: true,
        version,
        path: 'gs'
      }
    } catch (error: any) {
      console.log('[系统检查] Ghostscript不可用:', error.message)
      return {
        name: 'Ghostscript',
        available: false,
        error: error.message
      }
    }
  }

  /**
   * 检查Tesseract数据文件
   */
  private async checkTesseractData(): Promise<DependencyStatus> {
    try {
      console.log('[系统检查] 检查Tesseract数据文件...')
      
      // 检查当前目录下的语言文件
      const currentDirFiles = await fs.readdir(process.cwd())
      const trainedDataFiles = currentDirFiles.filter(file => file.endsWith('.traineddata'))
      
      if (trainedDataFiles.length > 0) {
        console.log('[系统检查] 找到Tesseract数据文件:', trainedDataFiles)
        return {
          name: 'Tesseract Data',
          available: true,
          version: `${trainedDataFiles.length} 个语言文件`,
          path: trainedDataFiles.join(', ')
        }
      } else {
        console.log('[系统检查] 未找到Tesseract数据文件')
        return {
          name: 'Tesseract Data',
          available: false,
          error: '未找到.traineddata文件'
        }
      }
    } catch (error: any) {
      console.log('[系统检查] 检查Tesseract数据文件失败:', error.message)
      return {
        name: 'Tesseract Data',
        available: false,
        error: error.message
      }
    }
  }

  /**
   * 检查Sharp
   */
  private async checkSharp(): Promise<DependencyStatus> {
    try {
      console.log('[系统检查] 检查Sharp...')
      
      // 尝试导入sharp
      const sharp = require('sharp')
      const version = sharp.versions
      console.log('[系统检查] Sharp可用:', version)
      
      return {
        name: 'Sharp',
        available: true,
        version: JSON.stringify(version),
        path: 'node_modules/sharp'
      }
    } catch (error: any) {
      console.log('[系统检查] Sharp不可用:', error.message)
      return {
        name: 'Sharp',
        available: false,
        error: error.message
      }
    }
  }

  /**
   * 检查PDF-lib
   */
  private async checkPdfLib(): Promise<DependencyStatus> {
    try {
      console.log('[系统检查] 检查PDF-lib...')
      
      // 尝试导入pdf-lib
      require('pdf-lib')
      console.log('[系统检查] PDF-lib可用')
      
      return {
        name: 'PDF-lib',
        available: true,
        version: '已加载',
        path: 'node_modules/pdf-lib'
      }
    } catch (error: any) {
      console.log('[系统检查] PDF-lib不可用:', error.message)
      return {
        name: 'PDF-lib',
        available: false,
        error: error.message
      }
    }
  }

  /**
   * 获取npm版本
   */
  private async getNpmVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('npm --version')
      return stdout.trim()
    } catch (error) {
      return '未知'
    }
  }
}

// 创建单例实例
export const systemCheckService = new SystemCheckService()
