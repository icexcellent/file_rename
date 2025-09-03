import React, { useState, useEffect } from 'react'
import { ConfigProvider, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import RenameOperation from './pages/RenameOperation'
import ConfigurationOptions from './pages/ConfigurationOptions'
import ExecutionResults from './pages/ExecutionResults'
import { useConfigStore } from './stores/configStore'
import './App.css'

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('rename')
  const { loadConfig } = useConfigStore()

  useEffect(() => {
    // 加载配置
    console.log('[App] 开始加载配置...')
    loadConfig().then(() => {
      console.log('[App] 配置加载完成')
    }).catch((error) => {
      console.error('[App] 配置加载失败:', error)
    })
  }, [loadConfig])

  const tabs = [
    {
      key: 'rename',
      label: '重命名操作',
      children: <RenameOperation />
    },
    {
      key: 'config',
      label: '配置选项',
      children: <ConfigurationOptions />
    },
    {
      key: 'results',
      label: '执行结果',
      children: <ExecutionResults />
    }
  ]

  return (
    <ConfigProvider locale={zhCN}>
      <AntApp>
        <div className="app-container">
          <main className="app-main">
            <div className="tab-container">
              <div className="tab-header">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              
              <div className="tab-content">
                {tabs.find(tab => tab.key === activeTab)?.children}
              </div>
            </div>
          </main>
        </div>
      </AntApp>
    </ConfigProvider>
  )
}

export default App
