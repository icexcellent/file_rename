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
      this.worker = await createWorker('chi_sim+eng', 1, {
        logger: (m) => console.log('OCR:', m),
        errorHandler: (err) => console.error('OCR Error:', err),
      })

      // 设置OCR参数
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz中文汉字',
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

      console.log(`开始OCR识别: ${imagePath}`)
      
      const result = await this.worker.recognize(imagePath)
      
      console.log(`OCR识别完成: ${imagePath}, 置信度: ${result.data.confidence}%`)
      
      return {
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        language: 'chi_sim+eng'
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
          language: 'chi_sim+eng'
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

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return ['chi_sim', 'eng', 'chi_sim+eng']
  }
}

// 创建单例实例
export const ocrService = new OCRService()
