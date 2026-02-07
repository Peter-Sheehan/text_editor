import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { Modal, ProgressBar } from '@carbon/react'
import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm'

// const MODEL_ID = import.meta.env.VITE_MODEL_ID || 'Llama-3.2-1B-Instruct-q4f32_1-MLC'
const MODEL_ID = ''

interface WebLLMContextType {
  isLoading: boolean
  loadingProgress: number
  loadingStatus: string
  error: string | null
  isReady: boolean
  isSupported: boolean
  generateCompletion: (context: string) => Promise<string>
  generateText: (options: { prompt: string; context?: string; systemPrompt?: string }) => Promise<string>
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
  const engineRef = useRef<MLCEngine | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      // Check WebGPU support
      if (!navigator.gpu) {
        setIsSupported(false)
        setIsLoading(false)
        setError('WebGPU is not supported in your browser. AI features are disabled. Try using Chrome 113+ or Edge 113+.')
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

      // Load model
      try {
        const engine = await CreateMLCEngine(MODEL_ID, {
          initProgressCallback: (progress) => {
            if (cancelled) return
            setLoadingProgress(progress.progress * 100)
            setLoadingStatus(progress.text)
          },
        })

        if (cancelled) return
        engineRef.current = engine
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
    }
  }, [])

  const generateCompletion = useCallback(async (context: string): Promise<string> => {
    if (!engineRef.current) throw new Error('Model not loaded')

    const response = await engineRef.current.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You are an AI writing assistant. Complete the text naturally. Only output the completion, nothing else. Keep it brief (1-2 sentences max).',
        },
        {
          role: 'user',
          content: `Continue this text naturally:\n\n${context}`,
        },
      ],
      max_tokens: 50,
      temperature: 0.7,
      stop: ['\n\n', '.', '!', '?'],
    })

    return response.choices[0]?.message?.content?.trim() || ''
  }, [])

  const generateText = useCallback(
    async (options: { prompt: string; context?: string; systemPrompt?: string }): Promise<string> => {
      if (!engineRef.current) throw new Error('Model not loaded')

      const { prompt, context, systemPrompt = 'You are a helpful writing assistant. Respond concisely and helpfully.' } =
        options

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ]

      if (context) {
        messages.push({
          role: 'user',
          content: `Context from document:\n${context}\n\nUser request: ${prompt}`,
        })
      } else {
        messages.push({ role: 'user', content: prompt })
      }

      const response = await engineRef.current.chat.completions.create({
        messages,
        max_tokens: 500,
        temperature: 0.7,
      })

      return response.choices[0]?.message?.content || ''
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
          {!error && <ProgressBar label={loadingStatus} value={loadingProgress} max={100} size="big" />}

          {error && (
            <>
              <p className="loading-error-text">{error}</p>
              <p className="loading-error-note">
                The editor will still work, but AI features (Ask AI and predictive text) will be disabled.
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
