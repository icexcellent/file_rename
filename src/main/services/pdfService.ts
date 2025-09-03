import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import fs from 'fs-extra'
import path from 'path'

export interface PDFPage {
  pageNumber: number
  imagePath: string
  width: number
  height: number
}

export interface PDFInfo {
  pageCount: number
  title?: string
  author?: string
  subject?: string
}

export class PDFService {
  /**
   * 获取PDF信息
   */
  async getPDFInfo(pdfPath: string): Promise<PDFInfo> {
    try {
      const pdfBytes = await fs.readFile(pdfPath)
      const pdfDoc = await PDFDocument.load(pdfBytes)
      
      return {
        pageCount: pdfDoc.getPageCount(),
        title: pdfDoc.getTitle(),
        author: pdfDoc.getAuthor(),
        subject: pdfDoc.getSubject()
      }
    } catch (error: any) {
      console.error(`获取PDF信息失败: ${pdfPath}`, error)
      throw new Error(`获取PDF信息失败: ${error.message}`)
    }
  }

  /**
   * 将PDF页面转换为图片
   */
  async convertPageToImage(
    pdfPath: string, 
    pageNumber: number, 
    outputDir: string,
    dpi: number = 300
  ): Promise<string> {
    try {
      // 检查文件大小
      const stats = await fs.stat(pdfPath)
      const fileSizeInMB = stats.size / (1024 * 1024)
      if (fileSizeInMB > 100) {
        throw new Error(`PDF文件过大: ${fileSizeInMB.toFixed(2)}MB，超过100MB限制`)
      }

      // 创建输出目录
      await fs.ensureDir(outputDir)

      // 使用pdf2pic转换（这里简化处理，实际项目中需要安装pdf2pic）
      // 由于pdf2pic依赖问题，这里使用替代方案
      const outputPath = path.join(outputDir, `page_${pageNumber}.png`)
      
      // 模拟转换过程（实际项目中需要真实的PDF转图片实现）
      await this.simulatePDFToImage(pdfPath, pageNumber, outputPath, dpi)
      
      return outputPath
    } catch (error: any) {
      console.error(`PDF页面转换失败: ${pdfPath} 第${pageNumber}页`, error)
      throw new Error(`PDF页面转换失败: ${error.message}`)
    }
  }

  /**
   * 将PDF所有页面转换为图片
   */
  async convertAllPagesToImages(
    pdfPath: string, 
    outputDir: string,
    dpi: number = 300
  ): Promise<string[]> {
    try {
      const info = await this.getPDFInfo(pdfPath)
      const imagePaths: string[] = []
      
      console.log(`开始转换PDF: ${pdfPath}, 共${info.pageCount}页`)
      
      for (let i = 0; i < info.pageCount; i++) {
        try {
          const imagePath = await this.convertPageToImage(pdfPath, i + 1, outputDir, dpi)
          imagePaths.push(imagePath)
          
          // 添加延迟避免过度占用资源
          if (i < info.pageCount - 1) {
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        } catch (error) {
          console.error(`转换第${i + 1}页失败:`, error)
          // 继续处理其他页面
        }
      }
      
      console.log(`PDF转换完成: ${pdfPath}, 成功转换${imagePaths.length}页`)
      return imagePaths
    } catch (error: any) {
      console.error(`PDF转换失败: ${pdfPath}`, error)
      throw new Error(`PDF转换失败: ${error.message}`)
    }
  }

  /**
   * 模拟PDF转图片过程（实际项目中需要替换为真实实现）
   */
  private async simulatePDFToImage(
    _pdfPath: string, 
    _pageNumber: number, 
    outputPath: string, 
    dpi: number
  ): Promise<void> {
    // 这里是一个模拟实现，实际项目中需要使用真实的PDF转图片库
    // 比如：pdf2pic, pdf-poppler, 或者调用系统命令
    
    // 创建一个简单的占位图片
    const width = Math.round((8.5 * dpi) / 72) // 8.5英寸 * DPI / 72
    const height = Math.round((11 * dpi) / 72)  // 11英寸 * DPI / 72
    
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .png()
    .toFile(outputPath)
    
    // 模拟处理时间
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  /**
   * 检查文件是否为PDF
   */
  async isPDF(filePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath)
      // PDF文件以%PDF开头
      return buffer.subarray(0, 4).toString() === '%PDF'
    } catch (error) {
      return false
    }
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles(tempDir: string): Promise<void> {
    try {
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir)
        console.log(`临时目录已清理: ${tempDir}`)
      }
    } catch (error) {
      console.error(`清理临时文件失败: ${tempDir}`, error)
    }
  }
}

// 创建单例实例
export const pdfService = new PDFService()
