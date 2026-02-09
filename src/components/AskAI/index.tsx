import { useState, useCallback } from 'react'
import {
  Modal,
  TextArea,
  InlineLoading,
  InlineNotification,
} from '@carbon/react'
import { useWebLLM } from '@/context/WebLLMContext'
import styles from './styles.module.scss'

interface AskAIProps {
  onClose: () => void
  onSubmit: (text: string) => void
  selectedText?: string
}

export function AskAI({ onClose, onSubmit, selectedText }: AskAIProps) {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { generateText, isReady, isSupported } = useWebLLM()

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || !isReady || !isSupported || isGenerating) return

    setIsGenerating(true)
    setError(null)

    try {
      const result = await generateText({
        prompt: prompt.trim(),
        context: selectedText || undefined,
        systemPrompt: selectedText
          ? 'You are a helpful writing assistant. The user has selected some text and wants you to help with it. Respond with only the text that should replace or follow the selection, no explanations.'
          : 'You are a helpful writing assistant. Respond with text that can be directly inserted into a document. Be concise and helpful.',
      })

      onSubmit(result)
    } catch (err) {
      console.error('AI generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate response')
    } finally {
      setIsGenerating(false)
    }
  }, [prompt, isReady, isSupported, isGenerating, generateText, selectedText, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <Modal
      open
      onRequestClose={onClose}
      modalHeading="Ask AI"
      modalLabel={selectedText ? `Working with: "${selectedText.slice(0, 30)}${selectedText.length > 30 ? '...' : ''}"` : undefined}
      primaryButtonText={isGenerating ? 'Generating...' : 'Generate'}
      secondaryButtonText="Cancel"
      onRequestSubmit={handleSubmit}
      primaryButtonDisabled={!prompt.trim() || !isReady || !isSupported || isGenerating}
      size="md"
    >
      <div className={styles.askAiContent}>
        <TextArea
          id="ask-ai-prompt"
          labelText="Prompt"
          placeholder="What would you like the AI to write?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          rows={4}
        />

        {isGenerating && (
          <InlineLoading description="Generating response..." />
        )}

        {error && (
          <InlineNotification
            kind="error"
            title="Error"
            subtitle={error}
            lowContrast
            hideCloseButton
          />
        )}

        {!isSupported && (
          <InlineNotification
            kind="error"
            title="AI Unavailable"
            subtitle="WebGPU is required but not supported in your browser."
            lowContrast
            hideCloseButton
          />
        )}

        {isSupported && !isReady && !isGenerating && (
          <InlineNotification
            kind="warning"
            title="Loading"
            subtitle="AI model is still loading..."
            lowContrast
            hideCloseButton
          />
        )}
      </div>
    </Modal>
  )
}
