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
          if (window.electronAPI) {
            const savedConfig = await window.electronAPI.getConfig()
            if (savedConfig && Object.keys(savedConfig).length > 0) {
              set({ config: { ...defaultConfig, ...savedConfig } })
            }
          }
        } catch (error) {
          console.error('加载配置失败:', error)
        }
      },
      
      updateConfig: async (updates: Partial<Config>) => {
        const newConfig = { ...get().config, ...updates }
        set({ config: newConfig })
        
        try {
          if (window.electronAPI) {
            await window.electronAPI.setConfig(newConfig)
          }
        } catch (error) {
          console.error('保存配置失败:', error)
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
