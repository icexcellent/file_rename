import React, { useState } from 'react'
import { Button, Input, InputNumber, Checkbox, Space, Card, Typography, message, Alert } from 'antd'
import { RobotOutlined, SettingOutlined, FileTextOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons'
import { useConfigStore } from '@/stores/configStore'

const { Title, Text } = Typography

const ConfigurationOptions: React.FC = () => {
  const { config, updateConfig } = useConfigStore()
  const [showApiKey, setShowApiKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  const handleConfigChange = async (key: keyof typeof config, value: any) => {
    await updateConfig({ [key]: value })
  }

  const handleTestAPI = async () => {
    if (!config.deepseekApiKey) {
      message.warning('请先输入API密钥')
      return
    }

    setIsTesting(true)
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.testDeepSeekAPI(config.deepseekApiKey)
        
        if (result.success) {
          message.success(result.message)
        } else {
          message.error(result.message)
        }
      } else {
        // 模拟API测试（开发环境）
        await new Promise(resolve => setTimeout(resolve, 2000))
        message.success('API连接成功！')
      }
    } catch (error: any) {
      message.error(`API连接失败: ${error.message}`)
    } finally {
      setIsTesting(false)
    }
  }

  const handleClearAPI = () => {
    updateConfig({ deepseekApiKey: '' })
    message.info('API密钥已清空')
  }

  return (
    <div className="configuration-options">
      <Title level={3}>配置选项</Title>
      
      {/* DeepSeek API配置 */}
      <Card 
        title={
          <Space>
            <RobotOutlined />
            <span>DeepSeek API配置</span>
          </Space>
        } 
        className="config-card"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Input
              placeholder="请输入API密钥"
              type={showApiKey ? 'text' : 'password'}
              value={config.deepseekApiKey}
              onChange={(e) => handleConfigChange('deepseekApiKey', e.target.value)}
              style={{ width: '300px' }}
              addonAfter={
                <Button
                  type="text"
                  icon={showApiKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  onClick={() => setShowApiKey(!showApiKey)}
                />
              }
            />
            <Button 
              type="primary" 
              icon={<SettingOutlined />}
              onClick={handleTestAPI}
              loading={isTesting}
            >
              测试API
            </Button>
            <Button 
              danger 
              icon={<FileTextOutlined />}
              onClick={handleClearAPI}
            >
              清空
            </Button>
          </Space>
          
          <div className="api-status">
            <Text type="secondary">
              API状态: {config.deepseekApiKey ? '已配置' : '未配置'}
            </Text>
          </div>
          
          <div className="api-instructions">
            <Text type="secondary">
              如何获取API密钥：
            </Text>
            <br />
            <Text type="secondary">
              1. 访问 https://platform.deepseek.com/
            </Text>
            <br />
            <Text type="secondary">
              2. 注册并登录您的账户
            </Text>
          </div>
        </Space>
      </Card>

      {/* 重命名规则 */}
      <Card 
        title={
          <Space>
            <SettingOutlined />
            <span>重命名规则</span>
          </Space>
        } 
        className="config-card"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space align="center">
            <Text>文本提取长度:</Text>
            <InputNumber
              min={10}
              max={500}
              value={config.textExtractionLength}
              onChange={(value) => handleConfigChange('textExtractionLength', value)}
            />
            <Text type="secondary">字符</Text>
          </Space>
          
          <Space align="center">
            <Text>文件名最大长度:</Text>
            <InputNumber
              min={10}
              max={200}
              value={config.maxFileNameLength}
              onChange={(value) => handleConfigChange('maxFileNameLength', value)}
            />
            <Text type="secondary">字符</Text>
          </Space>
          
          <Space direction="vertical">
            <Checkbox
              checked={config.convertToLowercase}
              onChange={(e) => handleConfigChange('convertToLowercase', e.target.checked)}
            >
              转换为小写
            </Checkbox>
            
            <Checkbox
              checked={config.convertSpacesToUnderscores}
              onChange={(e) => handleConfigChange('convertSpacesToUnderscores', e.target.checked)}
            >
              空格转换为下划线
            </Checkbox>
          </Space>
        </Space>
      </Card>

      {/* 文件类型过滤 */}
      <Card 
        title={
          <Space>
            <FileTextOutlined />
            <span>文件类型过滤</span>
          </Space>
        } 
        className="config-card"
      >
        <Space direction="vertical">
          <Checkbox
            checked={config.imageFiles}
            onChange={(e) => handleConfigChange('imageFiles', e.target.checked)}
          >
            图片文件 (jpg, png, gif, bmp等)
          </Checkbox>
          
          <Checkbox
            checked={config.pdfFiles}
            onChange={(e) => handleConfigChange('pdfFiles', e.target.checked)}
          >
            PDF文件
          </Checkbox>
          
          <Checkbox
            checked={config.documentFiles}
            onChange={(e) => handleConfigChange('documentFiles', e.target.checked)}
          >
            文档文件 (docx, txt等)
          </Checkbox>
        </Space>
      </Card>

      {/* 配置说明 */}
      <Card title="配置说明" className="config-card">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            message="文本提取长度"
            description="从文件内容中提取的文本长度，影响重命名文件名的描述性"
            type="info"
            showIcon
          />
          <Alert
            message="文件名最大长度"
            description="生成的文件名最大字符数，超过此长度将被截断"
            type="info"
            showIcon
          />
          <Alert
            message="文件大小限制"
            description="单个文件不能超过100MB，超过此限制的文件将被跳过"
            type="warning"
            showIcon
          />
          <Alert
            message="并发处理"
            description="最多同时处理100个文件，超过此数量的文件将被拒绝"
            type="warning"
            showIcon
          />
        </Space>
      </Card>

      {/* 保存配置 */}
      <Card className="config-card">
        <Button 
          type="primary" 
          size="large"
          icon={<FileTextOutlined />}
          onClick={() => message.success('配置已保存')}
        >
          保存配置
        </Button>
      </Card>
    </div>
  )
}

export default ConfigurationOptions
