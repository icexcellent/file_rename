import React from 'react'
import { Card, Typography, Progress, Table, Button, Space, Tag, Statistic, Row, Col, Tooltip } from 'antd'
import { DownloadOutlined, ReloadOutlined, FileTextOutlined, DeleteOutlined } from '@ant-design/icons'
import { useRenameStore } from '../stores/renameStore'
import './ExecutionResults.css'

const { Title, Text } = Typography

interface ExecutionResult {
  id: string
  originalFileName: string
  newFileName: string
  operation: 'success' | 'failed' | 'skipped'
  time: string
  errorReason?: string
}

const ExecutionResults: React.FC = () => {
  const { results, isProcessing, clearResults, clearLogs } = useRenameStore()

  // 模拟数据
  const mockResults: ExecutionResult[] = [
    {
      id: '1',
      originalFileName: 'document1.pdf',
      newFileName: '智能文档分析报告_2024.pdf',
      operation: 'success',
      time: '2024-01-15 10:30:25'
    },
    {
      id: '2',
      originalFileName: 'image1.jpg',
      newFileName: '会议照片_团队讨论.jpg',
      operation: 'success',
      time: '2024-01-15 10:30:30'
    },
    {
      id: '3',
      originalFileName: 'large_file.pdf',
      newFileName: '',
      operation: 'failed',
      time: '2024-01-15 10:30:35',
      errorReason: '文件超过100MB限制'
    }
  ]

  const handleRefresh = () => {
    // 刷新功能已通过全局状态自动更新
    console.log('刷新执行结果')
  }

  const handleExportLog = () => {
    // TODO: 实现日志导出功能
    console.log('导出日志')
  }

  const columns = [
    {
      title: '原文件名',
      dataIndex: 'originalPath',
      key: 'originalPath',
      width: '30%',
      render: (text: string) => {
        const fileName = text ? text.split('/').pop() || text : '-'
        return (
          <Tooltip title={text || '-'} placement="top">
            <Text copyable style={{ maxWidth: '200px', display: 'block' }}>
              {fileName}
            </Text>
          </Tooltip>
        )
      }
    },
    {
      title: '新文件名',
      dataIndex: 'newPath',
      key: 'newPath',
      width: '30%',
      render: (text: string) => {
        const fileName = text ? text.split('/').pop() || text : '-'
        return (
          <Tooltip title={text || '-'} placement="top">
            <Text copyable style={{ maxWidth: '200px', display: 'block' }}>
              {fileName}
            </Text>
          </Tooltip>
        )
          }
    },
    {
      title: '状态',
      dataIndex: 'success',
      key: 'success',
      width: '15%',
      render: (success: boolean) => {
        const color = success ? 'green' : 'red'
        const text = success ? '成功' : '失败'
        return <Tag color={color}>{text}</Tag>
      }
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: '25%'
    }
  ]

  // 计算统计数据
  const totalCount = results.length
  const successCount = results.filter(r => r.success).length
  const failedCount = results.filter(r => !r.success).length
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0

  return (
    <div className="execution-results">
      <Title level={3}>执行结果</Title>
      
      {/* 执行统计 */}
      <Card title="执行统计" className="results-card">
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="总文件数"
              value={totalCount}
              prefix={<FileTextOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="成功"
              value={successCount}
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="失败"
              value={failedCount}
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="成功率"
              value={totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0}
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
        </Row>
        
        {totalCount > 0 && (
          <div style={{ marginTop: '16px' }}>
            <Progress
              percent={totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0}
              status={failedCount > 0 ? 'exception' : 'success'}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </div>
        )}
      </Card>

      {/* 详细结果 */}
      <Card 
        title="详细结果" 
        className="results-card"
        extra={
          <Space>
            <Button 
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
            >
              刷新
            </Button>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={handleExportLog}
            >
              导出日志
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={results}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
          expandable={{
            expandedRowRender: (record) => {
              if (record.operation === 'failed' && record.errorReason) {
                return (
                  <div style={{ padding: '16px', backgroundColor: '#fafafa' }}>
                    <Text strong>失败原因：</Text>
                    <Text type="danger">{record.errorReason}</Text>
                  </div>
                )
              }
              return null
            },
            rowExpandable: (record) => !record.success && !!record.errorReason
          }}
          locale={{
            emptyText: '暂无执行结果，请先执行重命名操作'
          }}
        />
      </Card>
    </div>
  )
}

export default ExecutionResults
