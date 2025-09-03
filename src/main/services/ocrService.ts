import { createWorker } from 'tesseract.js'
import fs from 'fs-extra'

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
    if (this.isInitialized) return

    try {
      // 使用中文模型，获得更好的中文识别效果
      this.worker = await createWorker('chi_sim', 1, {
        logger: (m) => console.log('[OCR]', m),
        errorHandler: (err) => console.error('[OCR Error]', err),
      })

      // 使用最基本的参数设置
      await this.worker.setParameters({
        tessedit_pageseg_mode: '1', // 自动页面分割
        tessedit_ocr_engine_mode: '3', // 默认引擎
      })

      this.isInitialized = true
      console.log('OCR服务初始化成功')
    } catch (error) {
      console.error('OCR服务初始化失败:', error)
      throw new Error('OCR服务初始化失败')
    }
  }

  /**
   * 识别图片中的文字
   */
  async recognizeText(imagePath: string): Promise<OCRResult> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      // 检查文件是否存在
      if (!await fs.pathExists(imagePath)) {
        throw new Error(`图片文件不存在: ${imagePath}`)
      }

      // 检查文件大小
      const stats = await fs.stat(imagePath)
      const fileSizeInMB = stats.size / (1024 * 1024)
      if (fileSizeInMB > 100) {
        throw new Error(`文件过大: ${fileSizeInMB.toFixed(2)}MB，超过100MB限制`)
      }

      console.log(`[OCR] 开始识别图片: ${imagePath}`)
      console.log(`[OCR] 文件大小: ${fileSizeInMB.toFixed(2)}MB`)
      console.log(`[OCR] 使用语言: chi_sim`)
      
      // 检查图片是否为空白图片（通过检查文件大小和内容）
      if (fileSizeInMB < 0.1) {
        console.log(`[OCR] 警告: 图片文件过小(${fileSizeInMB.toFixed(3)}MB)，可能是空白占位图片`)
      }
      
      // 暂时跳过图像预处理，直接识别
      const result = await this.worker.recognize(imagePath)
      
      console.log(`[OCR] 识别完成: ${imagePath}`)
      console.log(`[OCR] 识别文本长度: ${result.data.text.length} 字符`)
      console.log(`[OCR] 识别文本预览: ${result.data.text.substring(0, 200)}...`)
      console.log(`[OCR] 置信度: ${result.data.confidence}%`)
      
      // 检查识别结果是否有意义
      if (result.data.text.trim().length < 10) {
        console.log(`[OCR] 警告: 识别到的文本过短，可能识别失败或图片内容为空`)
      }
      
      return {
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        language: 'chi_sim'
      }
    } catch (error: any) {
      console.error(`OCR识别失败: ${imagePath}`, error)
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
