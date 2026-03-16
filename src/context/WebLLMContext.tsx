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
import { LLMAgent, DEFAULT_MODEL_ID, type GenerateTextOptions } from '@/agents/LLMAgent'

const MODEL_ID = import.meta.env.VITE_MODEL_ID || DEFAULT_MODEL_ID

interface WebLLMContextType {
  isLoading: boolean
  loadingProgress: number
  loadingStatus: string
  error: string | null
  isReady: boolean
  isSupported: boolean
  modelId: string
  /** Generate a short inline completion for predictive text */
  generateCompletion: (context: string) => Promise<string>
  /** Generate text with optional streaming; onStream receives chunks as they arrive */
  generateText: (
    options: { prompt: string; context?: string; systemPrompt?: string; onStream?: (chunk: string, done: boolean) => void }
  ) => Promise<string>
}

const WebLLMContext = createContext<WebLLMContextType | null>(null)

export function WebLLMProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingStatus, setLoadingStatus] = useState('Initializing...')
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const agentRef = useRef<LLMAgent | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      // Check WebGPU support
      if (!navigator.gpu) {
        setIsSupported(false)
        setIsLoading(false)
        setError(
          'WebGPU is not supported in your browser. AI features are disabled. Try using Chrome 113+ or Edge 113+.'
        )
        return
      }

      try {
        const adapter = await navigator.gpu.requestAdapter()
        if (cancelled) return
        if (!adapter) {
          setIsSupported(false)
          setIsLoading(false)
          setError('WebGPU adapter not available. AI features are disabled.')
          return
        }
      } catch {
        if (cancelled) return
        setIsSupported(false)
        setIsLoading(false)
        setError('WebGPU check failed. AI features are disabled.')
        return
      }

      // Initialize the LLM agent
      try {
        const agent = new LLMAgent({ modelId: MODEL_ID })
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
    if (!agentRef.current) throw new Error('LLM agent not loaded')
    return agentRef.current.predictiveComplete(context, { maxTokens: 40 })
  }, [])

  const generateText = useCallback(
    async (options: {
      prompt: string
      context?: string
      systemPrompt?: string
      onStream?: (chunk: string, done: boolean) => void
    }): Promise<string> => {
      if (!agentRef.current) throw new Error('LLM agent not loaded')
      const { prompt, context, systemPrompt, onStream } = options
      const genOptions: GenerateTextOptions = {
        context,
        systemPrompt,
        onStream,
      }
      return agentRef.current.generateText(prompt, genOptions)
    },
    []
  )

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
        modelId: MODEL_ID,
        generateCompletion,
        generateText,
      }}
    >
      <Modal
        open={showLoadingModal}
        onRequestClose={() => error && setDismissed(true)}
        modalHeading={error ? 'AI Features Unavailable' : 'Loading AI Model'}
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
                The editor will still work, but AI features (Ask AI and predictive text) will be
                disabled.
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
  if (!context) {
    throw new Error('useWebLLM must be used within a WebLLMProvider')
  }
  return context
}
