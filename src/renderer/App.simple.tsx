import React from 'react'

const AppSimple: React.FC = () => {
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f0f0f0',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: '#333', textAlign: 'center' }}>
        🎉 智能文件重命名工具
      </h1>
      
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h2>功能特性</h2>
        <ul>
          <li>✅ OCR文字识别（中文优先）</li>
          <li>✅ PDF文件处理</li>
          <li>✅ 智能文件重命名</li>
          <li>✅ 批量处理支持</li>
          <li>✅ 跨平台兼容</li>
        </ul>
        
        <h2>技术栈</h2>
        <ul>
          <li>Electron + React + TypeScript</li>
          <li>Tesseract.js OCR引擎</li>
          <li>DeepSeek AI API</li>
          <li>Ant Design UI组件</li>
        </ul>
        
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#e6f7ff', 
          border: '1px solid #91d5ff',
          borderRadius: '4px'
        }}>
          <p><strong>状态：</strong>应用已成功启动！</p>
          <p>如果您看到这个界面，说明Electron和React都工作正常。</p>
        </div>
      </div>
    </div>
  )
}

export default AppSimple

