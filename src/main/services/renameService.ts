import fs from 'fs-extra'
import path from 'path'
import { ocrService } from './ocrService'
import { pdfService } from './pdfService'
import axios from 'axios'

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
      console.log(`开始批量重命名，共${filePaths.length}个文件`)
      
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
          const result = await this.renameFile(filePath, options)
          results.push(result)
          
          if (result.success) {
            this.currentProgress.status = 'completed'
          } else {
            this.currentProgress.status = 'failed'
          }
          
          onResult?.(result)
          
          // 添加延迟避免过度占用资源
          if (i < filePaths.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        } catch (error: any) {
          console.error(`重命名文件失败: ${filePath}`, error)
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
      
      console.log(`批量重命名完成，成功: ${results.filter(r => r.success).length}, 失败: ${results.filter(r => !r.success).length}`)
      
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
      const extractedText = await this.extractTextFromFile(filePath, options)
      
      // 生成新文件名
      const newFileName = await this.generateNewFileName(extractedText, path.extname(filePath), options)
      
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
  private async extractTextFromFile(filePath: string, options: RenameOptions): Promise<string> {
    try {
      const ext = path.extname(filePath).toLowerCase()
      
      // 图片文件OCR
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext)) {
        const ocrResult = await ocrService.recognizeText(filePath)
        return ocrResult.text.substring(0, options.textExtractionLength)
      }
      
      // PDF文件处理
      if (ext === '.pdf') {
        const tempDir = path.join(path.dirname(filePath), '.temp_pdf_images')
        try {
          const imagePaths = await pdfService.convertAllPagesToImages(filePath, tempDir)
          let allText = ''
          
          for (const imagePath of imagePaths) {
            const ocrResult = await ocrService.recognizeText(imagePath)
            allText += ocrResult.text + ' '
          }
          
          return allText.substring(0, options.textExtractionLength)
        } finally {
          await pdfService.cleanupTempFiles(tempDir)
        }
      }
      
      // 文本文件直接读取
      if (['.txt', '.md'].includes(ext)) {
        const content = await fs.readFile(filePath, 'utf-8')
        return content.substring(0, options.textExtractionLength)
      }
      
      // 其他文件类型尝试OCR
      try {
        const ocrResult = await ocrService.recognizeText(filePath)
        return ocrResult.text.substring(0, options.textExtractionLength)
      } catch (error) {
        console.log(`OCR识别失败，使用文件名作为文本: ${filePath}`)
        return path.basename(filePath, ext)
      }
      
            } catch (error: any) {
          console.error(`提取文本失败: ${filePath}`, error)
          return path.basename(filePath, path.extname(filePath))
        }
  }

  /**
   * 生成新文件名
   */
  private async generateNewFileName(text: string, extension: string, options: RenameOptions): Promise<string> {
    try {
      let newName = text
      
      // 如果文本为空，使用时间戳
      if (!newName || newName.trim() === '') {
        newName = `文件_${Date.now()}`
      }
      
      // 使用DeepSeek API优化文件名
      if (options.deepseekApiKey && text.length > 10) {
        try {
          const optimizedName = await this.optimizeFileNameWithAI(text, options.deepseekApiKey)
          if (optimizedName) {
            newName = optimizedName
          }
        } catch (error: any) {
          console.warn('AI优化文件名失败，使用原始文本:', error.message)
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
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'user',
              content: `请根据以下文本内容，生成一个简洁、描述性的文件名（不超过50个字符，不要包含扩展名）：\n\n${text}`
            }
          ],
          max_tokens: 100,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      )
      
      const optimizedName = response.data.choices[0]?.message?.content?.trim()
      return optimizedName || null
      
    } catch (error) {
      console.error('AI优化文件名失败:', error)
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
