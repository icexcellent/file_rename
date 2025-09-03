import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface RenameProgress {
  current: number
  total: number
  currentFile: string
  status: 'processing' | 'completed' | 'failed'
}

export interface RenameResult {
  originalPath: string
  newPath: string
  success: boolean
  errorReason?: string
  extractedText?: string
  confidence?: number
  timestamp: string
}

export interface RenameState {
  selectedFiles: string[]
  targetDirectory: string
  storageMode: 'copy' | 'overwrite'
  isProcessing: boolean
  progress: RenameProgress | null
  results: RenameResult[]
  executionLog: string[]
  
  // Actions
  setSelectedFiles: (files: string[]) => void
  setTargetDirectory: (directory: string) => void
  setStorageMode: (mode: 'copy' | 'overwrite') => void
  setIsProcessing: (processing: boolean) => void
  setProgress: (progress: RenameProgress | null) => void
  addResult: (result: RenameResult) => void
  addLog: (message: string) => void
  clearAll: () => void
  clearResults: () => void
  clearLogs: () => void
}

export const useRenameStore = create<RenameState>()(
  persist(
    (set, get) => ({
      selectedFiles: [],
      targetDirectory: '',
      storageMode: 'copy',
      isProcessing: false,
      progress: null,
      results: [],
      executionLog: [],
      
      setSelectedFiles: (files: string[]) => set({ selectedFiles: files }),
      setTargetDirectory: (directory: string) => set({ targetDirectory: directory }),
      setStorageMode: (mode: 'copy' | 'overwrite') => set({ storageMode: mode }),
      setIsProcessing: (processing: boolean) => set({ isProcessing: processing }),
      setProgress: (progress: RenameProgress | null) => set({ progress }),
      
      addResult: (result: RenameResult) => {
        const newResult = {
          ...result,
          timestamp: new Date().toLocaleString()
        }
        set((state) => ({ 
          results: [...state.results, newResult] 
        }))
      },
      
      addLog: (message: string) => {
        const timestamp = new Date().toLocaleTimeString()
        set((state) => ({ 
          executionLog: [...state.executionLog, `[${timestamp}] ${message}`] 
        }))
      },
      
      clearAll: () => set({
        selectedFiles: [],
        targetDirectory: '',
        isProcessing: false,
        progress: null,
        results: [],
        executionLog: []
      }),
      
      clearResults: () => set({ results: [] }),
      clearLogs: () => set({ executionLog: [] })
    }),
    {
      name: 'rename-storage',
      partialize: (state) => ({
        selectedFiles: state.selectedFiles,
        targetDirectory: state.targetDirectory,
        storageMode: state.storageMode,
        results: state.results
      }),
    }
  )
)
