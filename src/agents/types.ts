export type ProgressCallback = (progress: number, status: string) => void

export type StreamCallback = (chunk: string, done: boolean) => void

export interface PredictiveCompletionOptions {
  maxTokens?: number
  temperature?: number
  contextWindow?: number
}

export interface GenerateTextOptions {
  systemPrompt?: string
  context?: string
  maxTokens?: number
  temperature?: number
  onStream?: StreamCallback
}

/** Common interface implemented by both WebLLM (GPU) and Transformers.js (CPU) agents */
export interface AIAgent {
  readonly ready: boolean
  readonly modelId: string
  initialize(onProgress?: ProgressCallback): Promise<void>
  predictiveComplete(textBefore: string, options?: PredictiveCompletionOptions): Promise<string>
  generateText(prompt: string, options?: GenerateTextOptions): Promise<string>
  destroy(): void
}
