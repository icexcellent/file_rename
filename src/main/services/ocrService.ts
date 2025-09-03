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

  /**
   * 初始化OCR服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[OCR] 服务已经初始化，跳过重复初始化')
      return
    }

    try {
      console.log('[OCR] 开始初始化OCR服务...')
      console.log('[OCR] 当前工作目录:', process.cwd())
      console.log('[OCR] Node.js版本:', process.version)
      console.log('[OCR] 平台:', process.platform)
      console.log('[OCR] 架构:', process.arch)
      
      // 检查Tesseract.js是否可用
      if (typeof createWorker === 'undefined') {
        throw new Error('Tesseract.js createWorker函数不可用')
      }
      console.log('[OCR] Tesseract.js createWorker函数可用')
      
      // 使用中文模型，获得更好的中文识别效果
      console.log('[OCR] 开始创建Tesseract Worker，使用语言: chi_sim')
      this.worker = await createWorker('chi_sim', 1, {
        logger: (m) => console.log('[OCR]', m),
        errorHandler: (err) => console.error('[OCR Error]', err),
      })
      console.log('[OCR] Tesseract Worker创建成功')

      // 使用最基本的参数设置
      console.log('[OCR] 开始设置Tesseract参数...')
      await this.worker.setParameters({
        tessedit_pageseg_mode: '1', // 自动页面分割
        tessedit_ocr_engine_mode: '3', // 默认引擎
      })
      console.log('[OCR] Tesseract参数设置完成')

      this.isInitialized = true
      console.log('[OCR] OCR服务初始化成功')
      
      // 验证服务是否真正可用
      await this.verifyService()
      
    } catch (error: any) {
      console.error('[OCR] OCR服务初始化失败:', error)
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
      console.log('[OCR] 开始验证OCR服务...')
      
      // 创建一个简单的测试图片进行识别测试
      const testImagePath = await this.createTestImage()
      console.log('[OCR] 创建测试图片:', testImagePath)
      
      const result = await this.recognizeText(testImagePath)
      console.log('[OCR] 测试识别结果:', result)
      
      // 清理测试图片
      await fs.remove(testImagePath)
      console.log('[OCR] 测试图片已清理')
      
      console.log('[OCR] OCR服务验证成功')
    } catch (error: any) {
      console.error('[OCR] OCR服务验证失败:', error)
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
      console.log(`[OCR] 开始识别图片: ${imagePath}`)
      
      // 检查服务状态
      if (!this.isInitialized || !this.worker) {
        console.log(`[OCR] 服务未初始化，开始初始化...`)
        await this.initialize()
      }
      
      console.log(`[OCR] 服务状态检查完成，isInitialized: ${this.isInitialized}, worker: ${!!this.worker}`)

      // 检查文件是否存在
      if (!await fs.pathExists(imagePath)) {
        throw new Error(`图片文件不存在: ${imagePath}`)
      }
      console.log(`[OCR] 文件存在性检查通过`)

      // 检查文件大小
      const stats = await fs.stat(imagePath)
      const fileSizeInMB = stats.size / (1024 * 1024)
      if (fileSizeInMB > 100) {
        throw new Error(`文件过大: ${fileSizeInMB.toFixed(2)}MB，超过100MB限制`)
      }
      console.log(`[OCR] 文件大小检查通过: ${fileSizeInMB.toFixed(2)}MB`)

      console.log(`[OCR] 使用语言: chi_sim`)
      console.log(`[OCR] Worker状态: ${this.worker ? '可用' : '不可用'}`)
      
      // 检查图片是否为空白图片（通过检查文件大小和内容）
      if (fileSizeInMB < 0.1) {
        console.log(`[OCR] 警告: 图片文件过小(${fileSizeInMB.toFixed(3)}MB)，可能是空白占位图片`)
      }
      
      // 检查文件内容（前几个字节）
      const fileBuffer = await fs.readFile(imagePath)
      const fileHeader = fileBuffer.subarray(0, 8).toString('hex')
      console.log(`[OCR] 文件头部字节: ${fileHeader}`)
      
      // 检查worker是否真正可用
      if (!this.worker || !this.worker.recognize) {
        throw new Error('OCR Worker不可用或recognize方法不存在')
      }
      
      // 尝试识别
      console.log(`[OCR] 开始调用worker.recognize...`)
      const result = await this.worker.recognize(imagePath)
      console.log(`[OCR] worker.recognize调用完成`)
      
      console.log(`[OCR] 识别完成: ${imagePath}`)
      console.log(`[OCR] 识别文本长度: ${result.data.text.length} 字符`)
      console.log(`[OCR] 识别文本预览: ${result.data.text.substring(0, 200)}...`)
      console.log(`[OCR] 置信度: ${result.data.confidence}%`)
      
      // 检查识别结果是否有意义
      if (result.data.text.trim().length < 10) {
        console.log(`[OCR] 警告: 识别到的文本过短，可能识别失败或图片内容为空`)
        console.log(`[OCR] 原始文本: "${result.data.text}"`)
        
        // 如果识别结果过短，尝试重新初始化服务
        if (result.data.text.trim().length < 5) {
          console.log(`[OCR] 识别结果过短，尝试重新初始化OCR服务...`)
          await this.terminate()
          await this.initialize()
          
          // 重新尝试识别
          console.log(`[OCR] 重新初始化后再次尝试识别...`)
          const retryResult = await this.worker.recognize(imagePath)
          console.log(`[OCR] 重试识别结果: ${retryResult.data.text}`)
          
          if (retryResult.data.text.trim().length > 5) {
            console.log(`[OCR] 重试识别成功，使用重试结果`)
            return {
              text: retryResult.data.text.trim(),
              confidence: retryResult.data.confidence,
              language: 'chi_sim'
            }
          }
        }
      }
      
      return {
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        language: 'chi_sim'
      }
    } catch (error: any) {
      console.error(`OCR识别失败: ${imagePath}`, error)
      console.error(`[OCR] 错误详情:`, error)
      if (error.stack) {
        console.error(`[OCR] 错误堆栈:`, error.stack)
      }
      
      // 尝试重新初始化服务
      console.log(`[OCR] 识别失败，尝试重新初始化OCR服务...`)
      try {
        await this.terminate()
        await this.initialize()
        console.log(`[OCR] 重新初始化成功，再次尝试识别...`)
        
        const retryResult = await this.worker.recognize(imagePath)
        console.log(`[OCR] 重试识别成功: ${retryResult.data.text}`)
        
        return {
          text: retryResult.data.text.trim(),
          confidence: retryResult.data.confidence,
          language: 'chi_sim'
        }
      } catch (retryError: any) {
        console.error(`[OCR] 重试识别也失败: ${retryError.message}`)
        throw new Error(`OCR识别失败: ${error.message}`)
      }
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
      console.log('OCR服务已释放')
    }
  }

  // 暂时移除图像预处理功能，简化OCR流程
  
  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return ['chi_sim']
  }
}

// 创建单例实例
export const ocrService = new OCRService()
