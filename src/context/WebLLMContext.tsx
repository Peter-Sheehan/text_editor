import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { CreateMLCEngine, type MLCEngine, type ChatCompletionMessageParam } from '@mlc-ai/web-llm'
import { Modal, ProgressBar } from '@carbon/react'

interface WebLLMContextType {
  isLoading: boolean
  loadingProgress: number
  loadingStatus: string
  error: string | null
  isReady: boolean
  isSupported: boolean
  generateCompletion: (context: string) => Promise<string>
  generateText: (options: GenerateTextOptions) => Promise<string>
}

interface GenerateTextOptions {
  prompt: string
  context?: string
  systemPrompt?: string
}

const WebLLMContext = createContext<WebLLMContextType | null>(null)

const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'

async function checkWebGPUSupport(): Promise<boolean> {
  if (!navigator.gpu) {
    return false
  }
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return adapter !== null
  } catch {
    return false
  }
}

export function WebLLMProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingStatus, setLoadingStatus] = useState('Checking WebGPU support...')
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const engineRef = useRef<MLCEngine | null>(null)

  useEffect(() => {
    let cancelled = false

    async function initEngine() {
      console.log('Checking WebGPU support...')
      const supported = await checkWebGPUSupport()
      console.log('WebGPU supported:', supported)

      if (!supported) {
        setIsSupported(false)
        setIsLoading(false)
        setError('WebGPU is not supported in your browser. AI features are disabled. Try using Chrome 113+ or Edge 113+.')
        return
      }

      try {
        console.log('Loading AI model:', MODEL_ID)
        setLoadingStatus('Loading AI model...')

        const engine = await CreateMLCEngine(MODEL_ID, {
          initProgressCallback: (progress) => {
            if (cancelled) return
            console.log('Loading progress:', progress.progress, progress.text)
            setLoadingProgress(progress.progress * 100)
            setLoadingStatus(progress.text)
          },
        })

        if (cancelled) return

        engineRef.current = engine
        setIsReady(true)
        setIsLoading(false)
        setLoadingStatus('Ready')
      } catch (err) {
        if (cancelled) return
        console.error('WebLLM initialization error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load model')
        setIsLoading(false)
      }
    }

    initEngine()

    return () => {
      cancelled = true
    }
  }, [])

  const generateCompletion = useCallback(async (context: string): Promise<string> => {
    if (!engineRef.current) {
      throw new Error('Model not loaded')
    }

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: 'You are an AI writing assistant. Complete the text naturally. Only output the completion, nothing else. Keep it brief (1-2 sentences max).',
      },
      {
        role: 'user',
        content: `Continue this text naturally:\n\n${context}`,
      },
    ]

    const response = await engineRef.current.chat.completions.create({
      messages,
      max_tokens: 50,
      temperature: 0.7,
      stop: ['\n\n', '.', '!', '?'],
    })

    const completion = response.choices[0]?.message?.content || ''
    return completion.trim()
  }, [])

  const generateText = useCallback(async (options: GenerateTextOptions): Promise<string> => {
    if (!engineRef.current) {
      throw new Error('Model not loaded')
    }

    const { prompt, context, systemPrompt } = options

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt || 'You are a helpful writing assistant. Respond concisely and helpfully.',
      },
    ]

    if (context) {
      messages.push({
        role: 'user',
        content: `Context from document:\n${context}\n\nUser request: ${prompt}`,
      })
    } else {
      messages.push({
        role: 'user',
        content: prompt,
      })
    }

    const response = await engineRef.current.chat.completions.create({
      messages,
      max_tokens: 500,
      temperature: 0.7,
    })

    return response.choices[0]?.message?.content || ''
  }, [])

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
          {!error && (
            <>
              <ProgressBar
                label={loadingStatus}
                value={loadingProgress}
                max={100}
                size="big"
              />
            </>
          )}

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
