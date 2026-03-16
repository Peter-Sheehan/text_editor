export type ProgressCallback = (progress: number, status: string) => void

export type StreamCallback = (chunk: string, done: boolean) => void

export interface PredictiveCompletionOptions {
  maxTokens?: number
  temperature?: number
  contextWindow?: number
  /**
   * The opening portion of the full document (first ~300 chars).
   * Gives the model a stable "topic anchor" even when the cursor is far from
   * the start, preventing off-topic completions like "19 year old team" when
   * the document is clearly about hurling.
   */
  documentContext?: string
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
