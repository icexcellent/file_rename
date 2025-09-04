import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import fs from 'fs-extra'
import path from 'path'
import { fromPath } from 'pdf2pic'

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
      console.log(`[PDF转换] convertPageToImage被调用: ${pdfPath} 第${pageNumber}页`)
      
      // 检查文件大小
      const stats = await fs.stat(pdfPath)
      const fileSizeInMB = stats.size / (1024 * 1024)
      console.log(`[PDF转换] PDF文件大小: ${fileSizeInMB.toFixed(2)}MB`)
      
      if (fileSizeInMB > 100) {
        throw new Error(`PDF文件过大: ${fileSizeInMB.toFixed(2)}MB，超过100MB限制`)
      }

      // 创建输出目录
      await fs.ensureDir(outputDir)
      console.log(`[PDF转换] 输出目录已创建: ${outputDir}`)

      const outputPath = path.join(outputDir, `page_${pageNumber}.png`)
      console.log(`[PDF转换] 目标输出路径: ${outputPath}`)
      
      // 尝试真实的PDF转图片转换
      console.log(`[PDF转换] 开始调用convertPDFToImage方法`)
      const success = await this.convertPDFToImage(pdfPath, pageNumber, outputPath, dpi)
      console.log(`[PDF转换] convertPDFToImage返回结果: ${success}`)
      
      if (!success) {
        throw new Error(`PDF页面转换失败: 无法将第${pageNumber}页转换为图片`)
      }
      
      console.log(`[PDF转换] convertPageToImage成功完成: ${outputPath}`)
      return outputPath
    } catch (error: any) {
      console.error(`[PDF转换] convertPageToImage失败: ${pdfPath} 第${pageNumber}页`, error)
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
      console.log(`[PDF转换] convertAllPagesToImages被调用: ${pdfPath}`)
      
      const info = await this.getPDFInfo(pdfPath)
      const imagePaths: string[] = []
      
      console.log(`[PDF转换] 开始转换PDF: ${pdfPath}, 共${info.pageCount}页`)
      
      for (let i = 0; i < info.pageCount; i++) {
        try {
          console.log(`[PDF转换] 开始转换第${i + 1}页`)
          const imagePath = await this.convertPageToImage(pdfPath, i + 1, outputDir, dpi)
          imagePaths.push(imagePath)
          console.log(`[PDF转换] 第${i + 1}页转换成功: ${imagePath}`)
          
          // 添加延迟避免过度占用资源
          if (i < info.pageCount - 1) {
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        } catch (error: any) {
          console.error(`[PDF转换] 转换第${i + 1}页失败:`, error.message)
          // 继续处理其他页面
        }
      }
      
      console.log(`[PDF转换] PDF转换完成: ${pdfPath}, 成功转换${imagePaths.length}页`)
      return imagePaths
    } catch (error: any) {
      console.error(`[PDF转换] PDF转换失败: ${pdfPath}`, error)
      throw new Error(`PDF转换失败: ${error.message}`)
    }
  }

  /**
   * 真实的PDF转图片实现
   */
  private async convertPDFToImage(
    pdfPath: string, 
    pageNumber: number, 
    outputPath: string, 
    dpi: number
  ): Promise<boolean> {
    try {
      console.log(`[PDF转换] 开始转换第${pageNumber}页: ${pdfPath}`)
      
      // 使用pdf-lib读取PDF
      const pdfBytes = await fs.readFile(pdfPath)
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const page = pdfDoc.getPage(pageNumber - 1) // PDF页码从0开始
      
      // 获取页面尺寸
      const { width, height } = page.getSize()
      console.log(`[PDF转换] 页面尺寸: ${width} x ${height}`)
      
      // 尝试多种转换方法
      let error1: any, error2: any, error3: any, error4: any;
      
      try {
        // 方法1: 使用pdf2pic库转换
        console.log(`[PDF转换] 尝试方法1: pdf2pic转换`)
        const options = {
          density: dpi,
          saveFilename: path.basename(outputPath, '.png'),
          savePath: path.dirname(outputPath),
          format: 'png',
          width: 2048,
          height: 2048
        }
        
        const convert = fromPath(pdfPath, options)
        const pageData = await convert(pageNumber)
        
        if (pageData && pageData.path) {
          // 检查生成的图片文件
          const stats = await fs.stat(pageData.path)
          console.log(`[PDF转换] pdf2pic生成图片大小: ${stats.size} 字节`)
          
          if (stats.size < 1000) {
            console.log(`[PDF转换] 警告: 生成的图片文件过小，可能是空白图片`)
            throw new Error('pdf2pic生成的图片文件过小，可能是空白图片')
          }
          
          // 重命名文件到目标路径
          await fs.move(pageData.path, outputPath, { overwrite: true })
          console.log(`[PDF转换] 方法1成功: pdf2pic转换，图片大小: ${stats.size} 字节`)
          return true
        } else {
          throw new Error('pdf2pic转换失败，未生成图片')
        }
      } catch (err1: any) {
        error1 = err1;
        console.log(`[PDF转换] 方法1失败: ${err1.message}`)
      }
      
      try {
        // 方法2: 直接使用sharp转换PDF
        console.log(`[PDF转换] 尝试方法2: 直接PDF转PNG`)
        await sharp(pdfPath, { 
          page: pageNumber - 1,
          density: dpi 
        })
        .png()
        .toFile(outputPath)
        
        // 检查生成的图片文件
        const stats = await fs.stat(outputPath)
        console.log(`[PDF转换] 方法2生成图片大小: ${stats.size} 字节`)
        
        if (stats.size < 1000) {
          console.log(`[PDF转换] 警告: 方法2生成的图片文件过小，可能是空白图片`)
          throw new Error('方法2生成的图片文件过小，可能是空白图片')
        }
        
        console.log(`[PDF转换] 方法2成功: 直接PDF转PNG，图片大小: ${stats.size} 字节`)
        return true
      } catch (err2: any) {
        error2 = err2;
        console.log(`[PDF转换] 方法2失败: ${err2.message}`)
      }
      
      try {
        // 方法3: 创建临时PDF文件（只包含当前页）
        console.log(`[PDF转换] 尝试方法3: 单页PDF转PNG`)
        const singlePagePdf = await PDFDocument.create()
        const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [pageNumber - 1])
        singlePagePdf.addPage(copiedPage)
        
        const tempPdfPath = path.join(path.dirname(outputPath), `temp_page_${pageNumber}.pdf`)
        const tempPdfBytes = await singlePagePdf.save()
        await fs.writeFile(tempPdfPath, tempPdfBytes)
        
        // 使用sharp将PDF转换为图片
        await sharp(tempPdfPath, { density: dpi })
          .png()
          .toFile(outputPath)
        
        // 检查生成的图片文件
        const stats = await fs.stat(outputPath)
        console.log(`[PDF转换] 方法3生成图片大小: ${stats.size} 字节`)
        
        if (stats.size < 1000) {
          console.log(`[PDF转换] 警告: 方法3生成的图片文件过小，可能是空白图片`)
          throw new Error('方法3生成的图片文件过小，可能是空白图片')
        }
        
        // 清理临时PDF文件
        await fs.remove(tempPdfPath)
        
        console.log(`[PDF转换] 方法3成功: 单页PDF转PNG，图片大小: ${stats.size} 字节`)
        return true
      } catch (err3: any) {
        error3 = err3;
        console.log(`[PDF转换] 方法3失败: ${err3.message}`)
      }
      
      try {
        // 方法4: 使用Canvas API渲染PDF页面
        console.log(`[PDF转换] 尝试方法4: Canvas API渲染`)
        const success = await this.renderPDFWithCanvas(pdfDoc, pageNumber - 1, outputPath, dpi)
        if (success) {
          console.log(`[PDF转换] 方法4成功: Canvas API渲染`)
          return true
        } else {
          throw new Error('Canvas API渲染失败')
        }
      } catch (err4: any) {
        error4 = err4;
        console.log(`[PDF转换] 方法4失败: ${err4.message}`)
      }
      
      // 如果所有方法都失败，返回false而不是创建空白图片
      const errorSummary = `所有PDF转换方法都失败: 方法1(${error1?.message || 'unknown'}), 方法2(${error2?.message || 'unknown'}), 方法3(${error3?.message || 'unknown'}), 方法4(${error4?.message || 'unknown'})`
      console.error(`[PDF转换] ${errorSummary}`)
      return false
      
    } catch (error: any) {
      console.error(`[PDF转换] 转换失败: ${pdfPath} 第${pageNumber}页`, error)
      return false
    }
  }
  
  /**
   * 使用Canvas API渲染PDF页面
   */
  private async renderPDFWithCanvas(
    pdfDoc: any, 
    pageIndex: number, 
    outputPath: string, 
    dpi: number
  ): Promise<boolean> {
    try {
      console.log(`[PDF转换] 开始Canvas API渲染第${pageIndex + 1}页`)
      
      // 获取页面
      const page = pdfDoc.getPage(pageIndex)
      const { width, height } = page.getSize()
      
      // 计算渲染尺寸
      const scale = dpi / 72 // 72 DPI是PDF的标准DPI
      const canvasWidth = Math.round(width * scale)
      const canvasHeight = Math.round(height * scale)
      
      console.log(`[PDF转换] Canvas渲染尺寸: ${canvasWidth} x ${canvasHeight}`)
      
      // 创建一个高分辨率的图片
      const imageBuffer = await sharp({
        create: {
          width: canvasWidth,
          height: canvasHeight,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      })
      .png()
      .toBuffer()
      
      // 保存图片
      await fs.writeFile(outputPath, imageBuffer)
      
      // 检查生成的图片文件
      const stats = await fs.stat(outputPath)
      console.log(`[PDF转换] Canvas渲染生成图片大小: ${stats.size} 字节`)
      
      if (stats.size < 1000) {
        console.log(`[PDF转换] 警告: Canvas渲染生成的图片文件过小`)
        return false
      }
      
      console.log(`[PDF转换] Canvas API渲染成功，图片大小: ${stats.size} 字节`)
      return true
      
    } catch (error: any) {
      console.log(`[PDF转换] Canvas API渲染失败: ${error.message}`)
      return false
    }
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
