import React, { useEffect } from 'react'
import { Button, Input, Radio, Space, Card, Typography, message, Progress, Alert } from 'antd'
import { FolderOpenOutlined, FileOutlined, PlayCircleOutlined, RollbackOutlined, StopOutlined } from '@ant-design/icons'
import { useConfigStore } from '../stores/configStore'
import { useRenameStore, RenameResult, RenameProgress } from '../stores/renameStore'
import './RenameOperation.css'

const { Title, Text } = Typography

const RenameOperation: React.FC = () => {
  const { config } = useConfigStore()
  const {
    selectedFiles,
    targetDirectory,
    storageMode,
    isProcessing,
    progress,
    executionLog,
    setSelectedFiles,
    setTargetDirectory,
    setStorageMode,
    setIsProcessing,
    setProgress,
    addResult,
    addLog,
    clearAll,
    clearResults,
    clearLogs
  } = useRenameStore()

  useEffect(() => {
    // 设置IPC监听器
    if (window.electronAPI) {
      window.electronAPI.onProgress((progressData: RenameProgress) => {
        setProgress(progressData)
        handleAddLog(`处理文件: ${progressData.currentFile} (${progressData.current}/${progressData.total})`)
      })

      window.electronAPI.onResult((result: RenameResult) => {
        addResult(result)
        if (result.success) {
          handleAddLog(`✓ 成功: ${result.originalPath} → ${result.newPath}`)
        } else {
          handleAddLog(`✗ 失败: ${result.originalPath} - ${result.errorReason}`)
        }
      })

      window.electronAPI.onError((error: any) => {
        handleAddLog(`✗ 错误: ${error.message}`)
        message.error(`处理错误: ${error.message}`)
      })
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('progress-update')
        window.electronAPI.removeAllListeners('result-update')
        window.electronAPI.removeAllListeners('error-update')
      }
    }
  }, [])

  const handleAddLog = (message: string) => {
    addLog(message)
  }

  const handleSelectFiles = async () => {
    try {
      if (window.electronAPI) {
        const files = await window.electronAPI.selectFiles()
        setSelectedFiles(files)
        handleAddLog(`已选择 ${files.length} 个文件`)
        message.success(`已选择 ${files.length} 个文件`)
      }
          } catch (error) {
        message.error('选择文件失败')
        handleAddLog('选择文件失败')
      }
  }

  const handleSelectDirectory = async () => {
    try {
      if (window.electronAPI) {
        const directory = await window.electronAPI.selectDirectory()
        setTargetDirectory(directory)
        handleAddLog(`已选择目标目录: ${directory}`)
        message.success('已选择目标目录')
      }
    } catch (error) {
      message.error('选择目录失败')
      handleAddLog('选择目录失败')
    }
  }



  const handleStartRename = async () => {
    if (selectedFiles.length === 0) {
      message.warning('请先选择要重命名的文件')
      return
    }

    if (storageMode === 'copy' && !targetDirectory) {
      message.warning('复制模式下请选择目标目录')
      return
    }

    if (selectedFiles.length > 100) {
      message.error('文件数量过多，最多支持100个文件')
      return
    }

    setIsProcessing(true)
    clearResults()
    clearLogs()
    setProgress(null)

          try {
        handleAddLog('开始重命名操作...')
      
      const options = {
        storageMode,
        targetDirectory: storageMode === 'copy' ? targetDirectory : undefined,
        textExtractionLength: config.textExtractionLength,
        maxFileNameLength: config.maxFileNameLength,
        convertToLowercase: config.convertToLowercase,
        convertSpacesToUnderscores: config.convertSpacesToUnderscores,
        deepseekApiKey: config.deepseekApiKey
      }

      if (window.electronAPI) {
        const result = await window.electronAPI.processFiles(selectedFiles, options)
        
        if (result.success) {
          handleAddLog(result.message)
          message.success('重命名操作已完成')
        } else {
          handleAddLog(`操作失败: ${result.error}`)
          message.error(`操作失败: ${result.error}`)
        }
      }
    } catch (error: any) {
      handleAddLog(`启动重命名失败: ${error.message}`)
      message.error('启动重命名失败')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStopRename = async () => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.stopRename()
              handleAddLog('重命名操作已停止')
      message.info('重命名操作已停止')
      }
    } catch (error) {
      message.error('停止操作失败')
    }
  }

  const getProgressPercent = () => {
    if (!progress) return 0
    return Math.round((progress.current / progress.total) * 100)
  }

  const getProgressStatus = () => {
    if (!progress) return 'normal'
    if (progress.status === 'failed') return 'exception'
    if (progress.status === 'completed') return 'success'
    return 'active'
  }

  return (
    <div className="rename-operation">
      <div className="title-row">
        <Title level={3}>重命名操作</Title>
        <Space>
          <Button 
            type="primary" 
            size="large"
            icon={<PlayCircleOutlined />}
            onClick={handleStartRename}
            loading={isProcessing}
            disabled={selectedFiles.length === 0 || (storageMode === 'copy' && !targetDirectory)}
          >
            开始重命名
          </Button>
          <Button 
            size="large"
            icon={<StopOutlined />}
            onClick={handleStopRename}
            disabled={!isProcessing}
          >
            停止操作
          </Button>
          <Button 
            size="large"
            icon={<RollbackOutlined />}
            disabled={true}
          >
            回滚操作
          </Button>
        </Space>
      </div>
      
      {/* 重命名操作配置 */}
      <Card title="重命名操作配置" className="operation-card">
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 文件选择 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>选择要重命名的文件/文件夹</Text>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                type="primary" 
                icon={<FileOutlined />}
                onClick={handleSelectFiles}
                disabled={isProcessing}
              >
                选择文件或文件夹
              </Button>
              <Input
                placeholder="未选择任何文件"
                value={selectedFiles.join(', ')}
                readOnly
                style={{ width: '100%' }}
              />
              {selectedFiles.length > 0 && (
                <Text type="secondary">
                  已选择 {selectedFiles.length} 个文件
                  {selectedFiles.length > 100 && (
                    <Text type="danger"> (超过100个文件限制)</Text>
                  )}
                </Text>
              )}
            </Space>
          </div>

          {/* 目标目录选择 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>选择目标目录</Text>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Input
                  placeholder="选择重命名后文件的存储目录"
                  value={targetDirectory}
                  readOnly
                  style={{ width: '400px' }}
                />
                <Button 
                  type="primary" 
                  icon={<FolderOpenOutlined />}
                  onClick={handleSelectDirectory}
                  disabled={isProcessing}
                >
                  选择目录
                </Button>
              </Space>
              {storageMode === 'copy' && !targetDirectory && (
                <Alert
                  message="复制模式下必须选择目标目录"
                  type="warning"
                  showIcon
                />
              )}
            </Space>
          </div>

          {/* 存储模式 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>存储模式</Text>
            <Radio.Group 
              value={storageMode} 
              onChange={(e) => setStorageMode(e.target.value)}
              disabled={isProcessing}
            >
              <Space direction="vertical">
                <Radio value="copy">
                  复制模式 (保留原文件, 重命名后存储到目标目录)
                </Radio>
                <Radio value="overwrite">
                  覆盖模式 (直接重命名原文件)
                </Radio>
              </Space>
            </Radio.Group>
          </div>
        </Space>
      </Card>

      {/* 进度显示 */}
      {progress && (
        <Card title="处理进度" className="operation-card">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Progress
              percent={getProgressPercent()}
              status={getProgressStatus()}
              format={() => `${progress.current}/${progress.total}`}
            />
            <Text>
              当前处理: {progress.currentFile}
            </Text>
            <Text type="secondary">
              状态: {progress.status === 'processing' ? '处理中' : progress.status === 'completed' ? '已完成' : '失败'}
            </Text>
          </Space>
        </Card>
      )}



      {/* 执行日志 */}
      <Card title="执行日志" className="operation-card">
        <div className="execution-log">
          {executionLog.length === 0 ? (
            <Text type="secondary">等待开始重命名操作...</Text>
          ) : (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {executionLog.map((log, index) => (
                <div key={index} style={{ marginBottom: '4px', fontFamily: 'monospace', fontSize: '12px' }}>
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

export default RenameOperation
