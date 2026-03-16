import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm'
import type { AIAgent, ProgressCallback, PredictiveCompletionOptions, GenerateTextOptions } from './types'

export { type AIAgent, type ProgressCallback, type PredictiveCompletionOptions, type GenerateTextOptions }

export const DEFAULT_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f32_1-MLC'

export interface LLMAgentConfig {
  modelId: string
  temperature?: number
  topP?: number
}

export class LLMAgent implements AIAgent {
  private engine: MLCEngine | null = null
  private config: Required<LLMAgentConfig>
  private initialized = false

  constructor(config: LLMAgentConfig) {
    this.config = {
      temperature: 0.7,
      topP: 0.9,
      ...config,
    }
  }

  get modelId(): string {
    return this.config.modelId
  }

  get ready(): boolean {
    return this.initialized && this.engine !== null
  }

  async initialize(onProgress?: ProgressCallback): Promise<void> {
    this.engine = await CreateMLCEngine(this.config.modelId, {
      initProgressCallback: (progress) => {
        onProgress?.(Math.round(progress.progress * 100), progress.text)
      },
    })
    this.initialized = true
  }

  /**
   * Predictive text completion: given text before the cursor, return a short continuation.
   * Used by the PredictiveText extension for ghost-text suggestions.
   */
  async predictiveComplete(
    textBefore: string,
    options: PredictiveCompletionOptions = {}
  ): Promise<string> {
    if (!this.engine) throw new Error('LLM agent not initialized')

    const {
      maxTokens = 40,
      temperature = 0.6,
      contextWindow = 500,
    } = options

    const context = textBefore.slice(-contextWindow)

    const response = await this.engine.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            "You are a predictive text assistant. Complete the text below naturally, staying strictly on the same topic. Output ONLY the completion — no explanations, no preamble. Max 1 sentence.",
        },
        { role: 'user', content: `Continue this text:\n${context}` },
      ],
      max_tokens: maxTokens,
      temperature,
      stop: ['\n\n', '。', '！', '？'],
    })

    return response.choices[0]?.message?.content?.trim() ?? ''
  }

  /**
   * Streaming predictive completion — yields text chunks as they arrive.
   */
  async *streamPredictiveComplete(
    textBefore: string,
    options: PredictiveCompletionOptions = {}
  ): AsyncGenerator<string> {
    if (!this.engine) throw new Error('LLM agent not initialized')

    const { maxTokens = 40, temperature = 0.6, contextWindow = 500 } = options
    const context = textBefore.slice(-contextWindow)

    const stream = await this.engine.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            "You are a predictive text assistant. Complete the user's writing naturally. Output ONLY the completion. Max 1–2 sentences.",
        },
        { role: 'user', content: context },
      ],
      max_tokens: maxTokens,
      temperature,
      stop: ['\n\n'],
      stream: true,
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) yield delta
    }
  }

  /**
   * General-purpose text generation for the Ask AI feature.
   * Supports optional streaming via the onStream callback.
   */
  async generateText(prompt: string, options: GenerateTextOptions = {}): Promise<string> {
    if (!this.engine) throw new Error('LLM agent not initialized')

    const {
      systemPrompt = 'You are a helpful writing assistant. Respond with text that can be directly inserted into a document.',
      context,
      maxTokens = 500,
      temperature = this.config.temperature,
      onStream,
    } = options

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    messages.push({
      role: 'user',
      content: context ? `Context:\n${context}\n\nRequest: ${prompt}` : prompt,
    })

    if (onStream) {
      const stream = await this.engine.chat.completions.create({
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      })

      let full = ''
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) {
          full += delta
          onStream(delta, false)
        }
      }
      onStream('', true)
      return full
    }

    const response = await this.engine.chat.completions.create({
      messages,
      max_tokens: maxTokens,
      temperature,
    })

    return response.choices[0]?.message?.content?.trim() ?? ''
  }

  destroy(): void {
    this.engine = null
    this.initialized = false
  }
}
