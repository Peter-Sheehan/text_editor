import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'
import { Modal, ProgressBar } from '@carbon/react'
import { LLMAgent, DEFAULT_MODEL_ID } from '@/agents/LLMAgent'
import { TransformersAgent, DEFAULT_TRANSFORMERS_MODEL } from '@/agents/TransformersAgent'
import type { AIAgent, GenerateTextOptions } from '@/agents/types'

/** True if the browser has a usable WebGPU adapter */
async function hasWebGPU(): Promise<boolean> {
  if (!navigator.gpu) return false
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return adapter !== null
  } catch {
    return false
  }
}

interface WebLLMContextType {
  isLoading: boolean
  loadingProgress: number
  loadingStatus: string
  error: string | null
  isReady: boolean
  isSupported: boolean
  modelId: string
  /** Whether inference is running on GPU (WebLLM) or CPU (transformers.js) */
  backend: 'webgpu' | 'cpu' | null
  generateCompletion: (context: string) => Promise<string>
  generateText: (
    options: { prompt: string; context?: string; systemPrompt?: string; onStream?: (chunk: string, done: boolean) => void }
  ) => Promise<string>
}

const WebLLMContext = createContext<WebLLMContextType | null>(null)

export function WebLLMProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingStatus, setLoadingStatus] = useState('Detecting capabilities…')
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [backend, setBackend] = useState<'webgpu' | 'cpu' | null>(null)
  const agentRef = useRef<AIAgent | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const gpuAvailable = await hasWebGPU()
      if (cancelled) return

      let agent: AIAgent

      if (gpuAvailable) {
        const modelId = import.meta.env.VITE_MODEL_ID || DEFAULT_MODEL_ID
        setBackend('webgpu')
        setLoadingStatus('Loading GPU model…')
        agent = new LLMAgent({ modelId })
      } else {
        const modelId = import.meta.env.VITE_TRANSFORMERS_MODEL_ID || DEFAULT_TRANSFORMERS_MODEL
        setBackend('cpu')
        setLoadingStatus('No WebGPU detected — loading CPU model…')
        agent = new TransformersAgent(modelId)
      }

      try {
        await agent.initialize((progress, status) => {
          if (cancelled) return
          setLoadingProgress(progress)
          setLoadingStatus(status)
        })

        if (cancelled) {
          agent.destroy()
          return
        }

        agentRef.current = agent
        setIsReady(true)
        setIsLoading(false)
      } catch (err) {
        if (cancelled) return
        setError((err as Error).message)
        setIsLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
      agentRef.current?.destroy()
      agentRef.current = null
    }
  }, [])

  const generateCompletion = useCallback(async (context: string): Promise<string> => {
    if (!agentRef.current) throw new Error('AI agent not loaded')
    return agentRef.current.predictiveComplete(context, { maxTokens: 40 })
  }, [])

  const generateText = useCallback(
    async (options: {
      prompt: string
      context?: string
      systemPrompt?: string
      onStream?: (chunk: string, done: boolean) => void
    }): Promise<string> => {
      if (!agentRef.current) throw new Error('AI agent not loaded')
      const { prompt, context, systemPrompt, onStream } = options
      const genOptions: GenerateTextOptions = { context, systemPrompt, onStream }
      return agentRef.current.generateText(prompt, genOptions)
    },
    []
  )

  // isSupported is always true now — we always have at least the CPU path
  const isSupported = true

  const showLoadingModal = isLoading || (error !== null && !dismissed)

  return (
    <WebLLMContext.Provider
      value={{
        isLoading,
        loadingProgress,
        loadingStatus,
        error,
        isReady,
        isSupported,
        modelId: agentRef.current?.modelId ?? '',
        backend,
        generateCompletion,
        generateText,
      }}
    >
      <Modal
        open={showLoadingModal}
        onRequestClose={() => error && setDismissed(true)}
        modalHeading={error ? 'AI Failed to Load' : 'Loading AI Model'}
        passiveModal={!error}
        primaryButtonText={error ? 'Continue without AI' : undefined}
        onRequestSubmit={() => setDismissed(true)}
        size="sm"
        preventCloseOnClickOutside
      >
        <div className="loading-content">
          {!error && (
            <ProgressBar label={loadingStatus} value={loadingProgress} max={100} size="big" />
          )}
          {error && (
            <>
              <p className="loading-error-text">{error}</p>
              <p className="loading-error-note">
                The editor will still work, but AI features will be disabled.
              </p>
            </>
          )}
        </div>
      </Modal>
      {children}
    </WebLLMContext.Provider>
  )
}

export function useWebLLM() {
  const context = useContext(WebLLMContext)
  if (!context) throw new Error('useWebLLM must be used within a WebLLMProvider')
  return context
}
