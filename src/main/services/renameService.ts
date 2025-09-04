import fs from 'fs-extra'
import path from 'path'
import axios from 'axios'
import { ocrService } from './ocrService.js'
import { pdfService } from './pdfService.js'

export interface RenameOptions {
  storageMode: 'copy' | 'overwrite'
  targetDirectory?: string
  textExtractionLength: number
  maxFileNameLength: number
  convertToLowercase: boolean
  convertSpacesToUnderscores: boolean
  deepseekApiKey: string
}

export interface RenameResult {
  originalPath: string
  newPath: string
  success: boolean
  errorReason?: string
  extractedText?: string
  confidence?: number
}

export interface RenameProgress {
  current: number
  total: number
  currentFile: string
  status: 'processing' | 'completed' | 'failed'
}

export class RenameService {
  private isProcessing = false
  private currentProgress: RenameProgress | null = null
  private logCallback?: (log: string) => void

  /**
   * 设置日志回调函数
   */
  setLogCallback(callback: (log: string) => void) {
    this.logCallback = callback
    // 同时设置OCR服务的日志回调
    ocrService.setLogCallback(callback)
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
   * 开始批量重命名
   */
  async startBatchRename(
    filePaths: string[], 
    options: RenameOptions,
    onProgress?: (progress: RenameProgress) => void,
    onResult?: (result: RenameResult) => void
  ): Promise<RenameResult[]> {
    if (this.isProcessing) {
      throw new Error('重命名操作正在进行中')
    }

    this.isProcessing = true
    const results: RenameResult[] = []
    
    try {
      this.sendLog(`[批量重命名] 开始批量重命名，文件数量: ${filePaths.length}`)
      this.sendLog(`[批量重命名] 配置选项: ${JSON.stringify(options, null, 2)}`)
      
      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i]
        
        // 更新进度
        this.currentProgress = {
          current: i + 1,
          total: filePaths.length,
          currentFile: path.basename(filePath),
          status: 'processing'
        }
        onProgress?.(this.currentProgress)
        
        try {
          this.sendLog(`[批量重命名] 开始处理文件 ${i + 1}/${filePaths.length}: ${path.basename(filePath)}`)
          const result = await this.renameFile(filePath, options)
          results.push(result)
          
          if (result.success) {
            this.sendLog(`[批量重命名] 文件处理成功: ${path.basename(filePath)}`)
            this.currentProgress.status = 'completed'
          } else {
            this.sendLog(`[批量重命名] 文件处理失败: ${path.basename(filePath)}, 原因: ${result.errorReason}`)
            this.currentProgress.status = 'failed'
          }
          
          onResult?.(result)
          
          // 添加延迟避免过度占用资源
          if (i < filePaths.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        } catch (error: any) {
          this.sendLog(`[批量重命名] 文件处理异常: ${path.basename(filePath)} - ${error.message}`)
          const errorResult: RenameResult = {
            originalPath: filePath,
            newPath: '',
            success: false,
            errorReason: error.message
          }
          results.push(errorResult)
          this.currentProgress.status = 'failed'
          onResult?.(errorResult)
        }
      }
      
      const successCount = results.filter(r => r.success).length
      const failedCount = results.filter(r => !r.success).length
      this.sendLog(`[批量重命名] 批量重命名完成，成功: ${successCount}, 失败: ${failedCount}`)
      this.sendLog(`[批量重命名] 成功率: ${((successCount / filePaths.length) * 100).toFixed(2)}%`)
      
    } finally {
      this.isProcessing = false
      this.currentProgress = null
    }
    
    return results
  }

  /**
   * 重命名单个文件
   */
  private async renameFile(filePath: string, options: RenameOptions): Promise<RenameResult> {
    try {
      // 检查文件是否存在
      if (!await fs.pathExists(filePath)) {
        throw new Error('文件不存在')
      }

      // 检查文件大小
      const stats = await fs.stat(filePath)
      const fileSizeInMB = stats.size / (1024 * 1024)
      if (fileSizeInMB > 100) {
        throw new Error(`文件过大: ${fileSizeInMB.toFixed(2)}MB，超过100MB限制`)
      }

      // 提取文本内容
      this.sendLog(`[重命名] 开始提取文件文本内容`)
      const extractedText = await this.extractTextFromFile(filePath, options)
      this.sendLog(`[重命名] 文本提取完成，长度: ${extractedText.length}`)
      
      // 生成新文件名
      this.sendLog(`[重命名] 开始生成新文件名`)
      const newFileName = await this.generateNewFileName(extractedText, path.extname(filePath), options)
      this.sendLog(`[重命名] 新文件名生成完成: ${newFileName}`)
      
      // 确定目标路径
      let targetPath: string
      if (options.storageMode === 'copy' && options.targetDirectory) {
        targetPath = path.join(options.targetDirectory, newFileName)
      } else {
        targetPath = path.join(path.dirname(filePath), newFileName)
      }
      
      // 检查目标文件是否已存在
      if (await fs.pathExists(targetPath)) {
        targetPath = this.generateUniquePath(targetPath)
      }
      
      // 执行重命名/复制
      if (options.storageMode === 'copy' && options.targetDirectory) {
        await fs.copy(filePath, targetPath)
      } else {
        await fs.move(filePath, targetPath)
      }
      
      return {
        originalPath: filePath,
        newPath: targetPath,
        success: true,
        extractedText,
        confidence: extractedText ? 100 : 0
      }
      
    } catch (error: any) {
      console.error(`重命名文件失败: ${filePath}`, error)
      return {
        originalPath: filePath,
        newPath: '',
        success: false,
        errorReason: error.message
      }
    }
  }

  /**
   * 从文件中提取文本
   */
  private async extractTextFromFile(filePath: string, _options: RenameOptions): Promise<string> {
    try {
      const ext = path.extname(filePath).toLowerCase()
      console.log(`[文本提取] 开始处理文件: ${filePath}`)
      console.log(`[文本提取] 文件类型: ${ext}`)
      
      // 图片文件OCR
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext)) {
        console.log(`[文本提取] 检测到图片文件，使用OCR识别`)
        try {
          const ocrResult = await ocrService.recognizeText(filePath)
          console.log(`[文本提取] OCR提取完成，文本长度: ${ocrResult.text.length}`)
          
          // 检查OCR结果是否有意义
          if (ocrResult.text && ocrResult.text.trim().length > 5) {
            console.log(`[文本提取] OCR结果有效，使用识别文本`)
            return ocrResult.text
          } else {
            console.log(`[文本提取] OCR结果过短或无意义，使用文件名`)
            const fileName = path.basename(filePath, ext)
            return fileName
          }
        } catch (error: any) {
          console.log(`[文本提取] 图片OCR识别失败: ${error.message}`)
          console.log(`[文本提取] 使用文件名作为fallback`)
          const fileName = path.basename(filePath, ext)
          return fileName
        }
      }
      
      // PDF文件处理（优先文本直读，失败回退图片OCR）
      if (ext === '.pdf') {
        console.log(`[文本提取] 检测到PDF文件，优先尝试文本直读(pdf-parse)`)
        const textFromPdf = await pdfService.extractTextFromPDF(filePath)
        if (textFromPdf && textFromPdf.trim().length >= 10) {
          console.log(`[文本提取] PDF文本直读成功，长度: ${textFromPdf.length}`)
          return textFromPdf
        }

        console.log(`[文本提取] PDF文本直读失败或文本过短，回退到图片OCR`)
        const tempDir = path.join(path.dirname(filePath), '.temp_pdf_images')
        try {
          const imagePaths = await pdfService.convertAllPagesToImages(filePath, tempDir)
          console.log(`[文本提取] PDF转换完成，生成了 ${imagePaths.length} 张图片`)

          if (imagePaths.length === 0) {
            console.log(`[文本提取] PDF转换失败，没有生成任何图片，使用文件名作为文本`)
            return path.basename(filePath, ext)
          }

          let allText = ''
          let successCount = 0

          for (let i = 0; i < imagePaths.length; i++) {
            try {
              console.log(`[文本提取] 处理PDF第 ${i + 1} 页图片`)
              const ocrResult = await ocrService.recognizeText(imagePaths[i])
              if (ocrResult.text && ocrResult.text.trim().length > 0) {
                allText += ocrResult.text + ' '
                successCount++
              }
            } catch (error: any) {
              console.log(`[文本提取] PDF第 ${i + 1} 页OCR失败: ${error.message}`)
            }
          }

          console.log(`[文本提取] PDF处理完成，成功处理 ${successCount}/${imagePaths.length} 页，总文本长度: ${allText.length}`)

          if (allText.trim().length === 0) {
            console.log(`[文本提取] PDF OCR没有识别到任何文本，使用文件名作为文本`)
            return path.basename(filePath, ext)
          }

          return allText
        } catch (error: any) {
          console.log(`[文本提取] PDF处理失败: ${error.message}`)
          console.log(`[文本提取] 使用文件名作为fallback`)
          return path.basename(filePath, ext)
        } finally {
          await pdfService.cleanupTempFiles(tempDir)
        }
      }
      
      // 文本文件直接读取
      if (['.txt', '.md'].includes(ext)) {
        console.log(`[文本提取] 检测到文本文件，直接读取内容`)
        const content = await fs.readFile(filePath, 'utf-8')
        console.log(`[文本提取] 文本文件读取完成，长度: ${content.length}`)
        return content
      }
      
      // 其他文件类型尝试OCR
      console.log(`[文本提取] 尝试OCR识别其他文件类型`)
      try {
        const ocrResult = await ocrService.recognizeText(filePath)
        console.log(`[文本提取] 其他文件OCR成功，文本长度: ${ocrResult.text.length}`)
        
        // 检查OCR结果是否有意义
        if (ocrResult.text && ocrResult.text.trim().length > 5) {
          return ocrResult.text
        } else {
          console.log(`[文本提取] OCR结果过短或无意义，使用文件名`)
          const fileName = path.basename(filePath, ext)
          console.log(`[文本提取] 使用文件名: ${fileName}`)
          return fileName
        }
      } catch (error: any) {
        console.log(`[文本提取] OCR识别失败: ${error.message}`)
        console.log(`[文本提取] 使用文件名作为文本: ${filePath}`)
        const fileName = path.basename(filePath, ext)
        console.log(`[文本提取] 使用文件名: ${fileName}`)
        return fileName
      }
    } catch (error: any) {
      console.error(`提取文本失败: ${filePath}`, error)
      console.log(`[文本提取] 使用文件名作为fallback`)
      return path.basename(filePath, path.extname(filePath))
    }
  }

    /**
   * 生成新文件名
   */
  private async generateNewFileName(text: string, extension: string, options: RenameOptions): Promise<string> {
    try {
      console.log(`[文件名生成] 开始生成新文件名`)
      console.log(`[文件名生成] 输入文本长度: ${text.length}`)
      console.log(`[文件名生成] 文件扩展名: ${extension}`)
      console.log(`[文件名生成] 配置选项:`, JSON.stringify(options, null, 2))
      console.log(`[文件名生成] DeepSeek API密钥: ${options.deepseekApiKey ? `${options.deepseekApiKey.substring(0, 8)}...` : '未配置'}`)
      
      let newName = text
      
      // 如果文本为空，使用时间戳
      if (!newName || newName.trim() === '') {
        newName = `文件_${Date.now()}`
        console.log(`[文件名生成] 文本为空，使用时间戳: ${newName}`)
      }
      
      // 使用DeepSeek API优化文件名
      if (options.deepseekApiKey && text.length > 10) {
        console.log(`[AI优化] 开始使用DeepSeek API优化文件名`)
        console.log(`[AI优化] 原始文本长度: ${text.length}`)
        console.log(`[AI优化] 原始文本预览: ${text.substring(0, 100)}...`)
        try {
          const optimizedName = await this.optimizeFileNameWithAI(text, options.deepseekApiKey)
          if (optimizedName) {
            console.log(`[AI优化] API调用成功，优化后文件名: ${optimizedName}`)
            // AI返回的文件名不包含扩展名，直接使用
            console.log(`[AI优化] 使用AI优化的文件名: ${optimizedName}`)
            newName = optimizedName
          } else {
            console.log(`[AI优化] API返回空结果，使用原始文本`)
          }
        } catch (error: any) {
          console.warn(`[AI优化] AI优化文件名失败，使用原始文本: ${error.message}`)
        }
      } else {
        if (!options.deepseekApiKey) {
          console.log(`[AI优化] 未配置DeepSeek API密钥，跳过AI优化`)
          console.log(`[AI优化] API密钥值: ${options.deepseekApiKey}`)
        } else if (text.length <= 10) {
          console.log(`[AI优化] 文本长度不足(${text.length} <= 10)，跳过AI优化`)
        }
      }
      
      // 应用格式转换
      if (options.convertToLowercase) {
        newName = newName.toLowerCase()
      }
      
      if (options.convertSpacesToUnderscores) {
        newName = newName.replace(/\s+/g, '_')
      }
      
      // 清理文件名中的非法字符
      newName = newName.replace(/[<>:"/\\|?*]/g, '_')
      
      // 限制长度
      if (newName.length > options.maxFileNameLength) {
        newName = newName.substring(0, options.maxFileNameLength)
      }
      
      return newName + extension
      
    } catch (error) {
      console.error('生成新文件名失败:', error)
      return `重命名文件_${Date.now()}${extension}`
    }
  }

  /**
   * 使用AI优化文件名
   */
  private async optimizeFileNameWithAI(text: string, apiKey: string): Promise<string | null> {
    try {
      console.log(`[DeepSeek API] 开始调用API`)
      console.log(`[DeepSeek API] 请求URL: https://api.deepseek.com/v1/chat/completions`)
      console.log(`[DeepSeek API] 模型: deepseek-chat`)
      console.log(`[DeepSeek API] 输入文本长度: ${text.length}`)
      
      const requestBody = {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: `请仔细分析文档内容，提取以下信息：
1. 基金名称或产品名称（如：展弘稳进1号7期私募基金、浦发银行产品等）
2. 文档类型（如：临时开放日公告、打款凭证、基本信息表、业务凭证、回单等）
3. 相关日期（如：2025年8月22日、2025-06-06等）
4. 客户姓名或相关方（如果有）

请直接返回重命名后的文件名，格式为：
基金名称-文档类型-日期

例如：
- 展弘稳进1号7期私募基金-临时开放日公告-20250822
- 浦发银行-业务凭证回单-仇健鸣-20250606
- 打款凭证-仇健鸣-20250606

注意：不要包含文件扩展名，系统会自动添加原文件的扩展名。

如果确实无法提取到足够信息，请返回"无法识别"。

请确保返回的文件名有意义且包含关键信息。

文档内容：
${text}`
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      }
      
      console.log(`[DeepSeek API] 请求体:`, JSON.stringify(requestBody, null, 2))
      console.log(`[DeepSeek API] 使用API密钥: ${apiKey.substring(0, 8)}...`)
      
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      )
      
      console.log(`[DeepSeek API] API响应状态: ${response.status}`)
      console.log(`[DeepSeek API] API响应头:`, response.headers)
      
      const optimizedName = response.data.choices[0]?.message?.content?.trim()
      console.log(`[DeepSeek API] 提取的优化名称: ${optimizedName}`)
      
      return optimizedName || null
      
    } catch (error: any) {
      console.error(`[DeepSeek API] API调用失败:`, error)
      if (error.response) {
        console.error(`[DeepSeek API] 错误响应状态: ${error.response.status}`)
        console.error(`[DeepSeek API] 错误响应数据:`, error.response.data)
      } else if (error.request) {
        console.error(`[DeepSeek API] 网络请求错误:`, error.request)
      } else {
        console.error(`[DeepSeek API] 其他错误:`, error.message)
      }
      return null
    }
  }

  /**
   * 生成唯一路径
   */
  private generateUniquePath(originalPath: string): string {
    const dir = path.dirname(originalPath)
    const ext = path.extname(originalPath)
    const name = path.basename(originalPath, ext)
    
    let counter = 1
    let newPath = originalPath
    
    while (fs.existsSync(newPath)) {
      newPath = path.join(dir, `${name}_${counter}${ext}`)
      counter++
    }
    
    return newPath
  }

  /**
   * 获取当前进度
   */
  getCurrentProgress(): RenameProgress | null {
    return this.currentProgress
  }

  /**
   * 检查是否正在处理
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing
  }

  /**
   * 停止处理
   */
  stopProcessing(): void {
    this.isProcessing = false
  }
}

// 创建单例实例
export const renameService = new RenameService()
