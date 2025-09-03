import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Config {
  deepseekApiKey: string
  textExtractionLength: number
  maxFileNameLength: number
  convertToLowercase: boolean
  convertSpacesToUnderscores: boolean
  imageFiles: boolean
  pdfFiles: boolean
  documentFiles: boolean
}

interface ConfigStore {
  config: Config
  loadConfig: () => Promise<void>
  updateConfig: (updates: Partial<Config>) => Promise<void>
  resetConfig: () => void
}

const defaultConfig: Config = {
  deepseekApiKey: '',
  textExtractionLength: 2000,
  maxFileNameLength: 60,
  convertToLowercase: false,
  convertSpacesToUnderscores: false,
  imageFiles: true,
  pdfFiles: true,
  documentFiles: true,
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      
      loadConfig: async () => {
        try {
          console.log('[配置Store] 开始加载配置')
          if (window.electronAPI) {
            console.log('[配置Store] electronAPI可用，开始获取配置')
            const savedConfig = await window.electronAPI.getConfig()
            console.log('[配置Store] 从主进程获取的配置:', savedConfig)
            if (savedConfig && Object.keys(savedConfig).length > 0) {
              const mergedConfig = { ...defaultConfig, ...savedConfig }
              console.log('[配置Store] 合并后的配置:', mergedConfig)
              set({ config: mergedConfig })
            } else {
              console.log('[配置Store] 未获取到配置，使用默认配置')
            }
          } else {
            console.log('[配置Store] electronAPI不可用')
          }
        } catch (error) {
          console.error('[配置Store] 加载配置失败:', error)
        }
      },
      
      updateConfig: async (updates: Partial<Config>) => {
        console.log('[配置Store] 开始更新配置:', updates)
        const newConfig = { ...get().config, ...updates }
        console.log('[配置Store] 更新后的完整配置:', newConfig)
        set({ config: newConfig })
        
        try {
          if (window.electronAPI) {
            console.log('[配置Store] 调用主进程保存配置')
            await window.electronAPI.setConfig(newConfig)
            console.log('[配置Store] 配置保存成功')
          } else {
            console.log('[配置Store] electronAPI不可用，无法保存配置')
          }
        } catch (error) {
          console.error('[配置Store] 保存配置失败:', error)
        }
      },
      
      resetConfig: () => {
        set({ config: defaultConfig })
        // 这里可以添加重置配置的逻辑
      },
    }),
    {
      name: 'config-storage',
      partialize: (state) => ({ config: state.config }),
    }
  )
)
