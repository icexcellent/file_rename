import { createWorker } from 'tesseract.js'
import fs from 'fs-extra'
import sharp from 'sharp'
import path from 'path'

export interface OCRResult {
  text: string
  confidence: number
  language: string
}

export class OCRService {
  private worker: any = null
  private isInitialized = false
  private logCallback?: (log: string) => void

  /**
   * 设置日志回调函数
   */
  setLogCallback(callback: (log: string) => void) {
    this.logCallback = callback
  }

  /**
   * 发送日志
   */
  private sendLog(message: string) {
    if (this.logCallback) {
      this.logCallback(message)
    }
    console.log(message)
  }

  /**
   * 初始化OCR服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.sendLog('[OCR] 服务已经初始化，跳过重复初始化')
      return
    }

    try {
      this.sendLog('[OCR] 开始初始化OCR服务...')
      this.sendLog(`[OCR] 当前工作目录: ${process.cwd()}`)
      this.sendLog(`[OCR] Node.js版本: ${process.version}`)
      this.sendLog(`[OCR] 平台: ${process.platform}`)
      this.sendLog(`[OCR] 架构: ${process.arch}`)
      
      // 检查Tesseract.js是否可用
      if (typeof createWorker === 'undefined') {
        throw new Error('Tesseract.js createWorker函数不可用')
      }
      this.sendLog('[OCR] Tesseract.js createWorker函数可用')
      
      // 检查Tesseract核心文件路径
      this.checkTesseractCorePath()
      
      // 使用中文模型，获得更好的中文识别效果
      this.sendLog('[OCR] 开始创建Tesseract Worker，使用语言: chi_sim')
      this.worker = await createWorker('chi_sim', 1, {
        logger: (m) => this.sendLog(`[OCR] ${JSON.stringify(m)}`),
        errorHandler: (err) => this.sendLog(`[OCR Error] ${err}`),
        corePath: this.getTesseractCorePath(),
      })
      this.sendLog('[OCR] Tesseract Worker创建成功')

      // 使用最基本的参数设置
      this.sendLog('[OCR] 开始设置Tesseract参数...')
      await this.worker.setParameters({
        tessedit_pageseg_mode: '1', // 自动页面分割
        tessedit_ocr_engine_mode: '3', // 默认引擎
      })
      this.sendLog('[OCR] Tesseract参数设置完成')

      this.isInitialized = true
      this.sendLog('[OCR] OCR服务初始化成功')
      
      // 验证服务是否真正可用
      await this.verifyService()
      
    } catch (error: any) {
      this.sendLog(`[OCR] OCR服务初始化失败: ${error.message}`)
      this.isInitialized = false
      this.worker = null
      throw new Error(`OCR服务初始化失败: ${error.message}`)
    }
  }

  /**
   * 验证OCR服务是否真正可用
   */
  private async verifyService(): Promise<void> {
    try {
      this.sendLog('[OCR] 开始验证OCR服务...')
      
      // 创建一个简单的测试图片进行识别测试
      const testImagePath = await this.createTestImage()
      this.sendLog(`[OCR] 创建测试图片: ${testImagePath}`)
      
      const result = await this.recognizeText(testImagePath)
      this.sendLog(`[OCR] 测试识别结果: ${JSON.stringify(result)}`)
      
      // 清理测试图片
      await fs.remove(testImagePath)
      this.sendLog('[OCR] 测试图片已清理')
      
      this.sendLog('[OCR] OCR服务验证成功')
    } catch (error: any) {
      this.sendLog(`[OCR] OCR服务验证失败: ${error.message}`)
      throw new Error(`OCR服务验证失败: ${error.message}`)
    }
  }

  /**
   * 创建测试图片
   */
  private async createTestImage(): Promise<string> {
    const testImagePath = path.join(process.cwd(), 'test_ocr_image.png')
    
    // 创建一个包含简单文字的测试图片
    await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .png()
    .toFile(testImagePath)
    
    return testImagePath
  }

  /**
   * 识别图片中的文字
   */
  async recognizeText(imagePath: string): Promise<OCRResult> {
    try {
      this.sendLog(`[OCR] 开始识别图片: ${imagePath}`)
      
      // 检查服务状态
      if (!this.isInitialized || !this.worker) {
        this.sendLog(`[OCR] 服务未初始化，开始初始化...`)
        await this.initialize()
      }
      
      this.sendLog(`[OCR] 服务状态检查完成，isInitialized: ${this.isInitialized}, worker: ${!!this.worker}`)

      // 检查文件是否存在
      if (!await fs.pathExists(imagePath)) {
        throw new Error(`图片文件不存在: ${imagePath}`)
      }
      this.sendLog(`[OCR] 文件存在性检查通过`)

      // 检查文件大小
      const stats = await fs.stat(imagePath)
      const fileSizeInMB = stats.size / (1024 * 1024)
      if (fileSizeInMB > 100) {
        throw new Error(`文件过大: ${fileSizeInMB.toFixed(2)}MB，超过100MB限制`)
      }
      this.sendLog(`[OCR] 文件大小检查通过: ${fileSizeInMB.toFixed(2)}MB`)

      this.sendLog(`[OCR] 使用语言: chi_sim`)
      this.sendLog(`[OCR] Worker状态: ${this.worker ? '可用' : '不可用'}`)
      
      // 检查图片是否为空白图片（通过检查文件大小和内容）
      if (fileSizeInMB < 0.1) {
        this.sendLog(`[OCR] 警告: 图片文件过小(${fileSizeInMB.toFixed(3)}MB)，可能是空白占位图片`)
      }
      
      // 检查文件内容（前几个字节）
      const fileBuffer = await fs.readFile(imagePath)
      const fileHeader = fileBuffer.subarray(0, 8).toString('hex')
      this.sendLog(`[OCR] 文件头部字节: ${fileHeader}`)
      
      // 检查worker是否真正可用
      if (!this.worker || !this.worker.recognize) {
        throw new Error('OCR Worker不可用或recognize方法不存在')
      }
      
      // 尝试识别
      this.sendLog(`[OCR] 开始调用worker.recognize...`)
      const result = await this.worker.recognize(imagePath)
      this.sendLog(`[OCR] worker.recognize调用完成`)
      
      this.sendLog(`[OCR] 识别完成: ${imagePath}`)
      this.sendLog(`[OCR] 识别文本长度: ${result.data.text.length} 字符`)
      this.sendLog(`[OCR] 识别文本预览: ${result.data.text.substring(0, 200)}...`)
      this.sendLog(`[OCR] 置信度: ${result.data.confidence}%`)
      
      // 检查识别结果是否有意义，但不进行重试
      if (result.data.text.trim().length < 10) {
        this.sendLog(`[OCR] 警告: 识别到的文本过短，可能识别失败或图片内容为空`)
        this.sendLog(`[OCR] 原始文本: "${result.data.text}"`)
      }
      
      return {
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        language: 'chi_sim'
      }
    } catch (error: any) {
      this.sendLog(`OCR识别失败: ${imagePath} - ${error.message}`)
      this.sendLog(`[OCR] 错误详情: ${error.message}`)
      if (error.stack) {
        this.sendLog(`[OCR] 错误堆栈: ${error.stack}`)
      }
      
      // 不进行重试，直接抛出错误
      throw new Error(`OCR识别失败: ${error.message}`)
    }
  }

  /**
   * 批量识别图片
   */
  async recognizeBatch(imagePaths: string[]): Promise<OCRResult[]> {
    const results: OCRResult[] = []
    
    for (let i = 0; i < imagePaths.length; i++) {
      try {
        const result = await this.recognizeText(imagePaths[i])
        results.push(result)
        
        // 添加延迟避免过度占用资源
        if (i < imagePaths.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`批量OCR识别失败: ${imagePaths[i]}`, error)
        // 返回空结果，让调用方处理错误
        results.push({
          text: '',
          confidence: 0,
          language: 'chi_sim'
        })
      }
    }
    
    return results
  }

  /**
   * 释放OCR资源
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
      this.isInitialized = false
      this.sendLog('OCR服务已释放')
    }
  }

  // 暂时移除图像预处理功能，简化OCR流程
  
  /**
   * 检查Tesseract核心文件路径
   */
  private checkTesseractCorePath(): void {
    const corePath = this.getTesseractCorePath()
    this.sendLog(`[OCR] Tesseract核心文件路径: ${corePath || '默认路径'}`)
    
    // 检查路径是否存在
    if (corePath && fs.existsSync(corePath)) {
      this.sendLog(`[OCR] ✓ 核心文件路径存在`)
    } else if (corePath) {
      this.sendLog(`[OCR] ✗ 核心文件路径不存在，可能导致初始化失败`)
    } else {
      this.sendLog(`[OCR] 使用默认核心文件路径`)
    }
  }

  /**
   * 获取Tesseract核心文件路径
   */
  private getTesseractCorePath(): string | undefined {
    // 在开发环境中使用默认路径
    if (process.env.NODE_ENV === 'development') {
      return undefined
    }
    
    // 在打包后的环境中，使用extraResources中的路径
    const platform = process.platform
    const arch = process.arch
    
    if (platform === 'win32') {
      // Windows
      if (arch === 'x64') {
        return path.join(process.resourcesPath, 'tesseract-core', 'tesseract-core-simd.wasm.js')
      } else {
        return path.join(process.resourcesPath, 'tesseract-core', 'tesseract-core.wasm.js')
      }
    } else if (platform === 'darwin') {
      // macOS
      if (arch === 'arm64') {
        return path.join(process.resourcesPath, 'tesseract-core', 'tesseract-core-simd.wasm.js')
      } else {
        return path.join(process.resourcesPath, 'tesseract-core', 'tesseract-core.wasm.js')
      }
    } else {
      // Linux
      if (arch === 'x64') {
        return path.join(process.resourcesPath, 'tesseract-core', 'tesseract-core-simd.wasm.js')
      } else {
        return path.join(process.resourcesPath, 'tesseract-core', 'tesseract-core.wasm.js')
      }
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return ['chi_sim']
  }
}

// 创建单例实例
export const ocrService = new OCRService()
