import type { AIAgent, ProgressCallback, PredictiveCompletionOptions, GenerateTextOptions } from './types'

/**
 * CPU-based inference agent using @huggingface/transformers (WASM/ONNX).
 * Works in any modern browser with no WebGPU requirement — ideal for Linux.
 *
 * Default model: SmolLM2-135M-Instruct (tiny, fast on CPU, ~270MB quantized)
 * Override via VITE_TRANSFORMERS_MODEL_ID env var.
 */
export const DEFAULT_TRANSFORMERS_MODEL = 'HuggingFaceTB/SmolLM2-135M-Instruct'

export class TransformersAgent implements AIAgent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pipeline: any = null
  private _modelId: string
  private _ready = false

  constructor(modelId = DEFAULT_TRANSFORMERS_MODEL) {
    this._modelId = modelId
  }

  get ready() { return this._ready }
  get modelId() { return this._modelId }

  async initialize(onProgress?: ProgressCallback): Promise<void> {
    // Dynamic import keeps transformers.js out of the initial bundle
    const { pipeline, env } = await import('@huggingface/transformers')

    // Use the remote model hub; disable local model path lookup
    env.allowLocalModels = false

    this.pipeline = await pipeline('text-generation', this._modelId, {
      dtype: 'q4',        // 4-bit quantisation for speed and memory
      device: 'wasm',     // CPU via WebAssembly — no WebGPU needed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress_callback: (data: any) => {
        if (data.status === 'progress' && typeof data.progress === 'number') {
          onProgress?.(Math.round(data.progress), `Downloading ${data.file ?? 'model'}…`)
        } else if (data.status === 'done') {
          onProgress?.(100, 'Model ready')
        } else if (data.status === 'initiate') {
          onProgress?.(0, `Loading ${data.file ?? 'model'}…`)
        }
      },
    })

    this._ready = true
  }

  async predictiveComplete(textBefore: string, options: PredictiveCompletionOptions = {}): Promise<string> {
    if (!this.pipeline) throw new Error('TransformersAgent not initialized')

    const { maxTokens = 40, temperature = 0.6, contextWindow = 500 } = options
    const context = textBefore.slice(-contextWindow)

    const output = await this.pipeline(context, {
      max_new_tokens: maxTokens,
      temperature,
      do_sample: temperature > 0,
      return_full_text: false,  // only the new tokens
    })

    const generated: string = Array.isArray(output)
      ? (output[0]?.generated_text ?? '')
      : (output?.generated_text ?? '')

    // Strip at sentence boundary for cleaner suggestions
    return generated.split(/(?<=[.!?])\s/)[0]?.trim() ?? ''
  }

  async generateText(prompt: string, options: GenerateTextOptions = {}): Promise<string> {
    if (!this.pipeline) throw new Error('TransformersAgent not initialized')

    const {
      systemPrompt = 'You are a helpful writing assistant.',
      context,
      maxTokens = 200,
      temperature = 0.7,
      onStream,
    } = options

    // Build a simple chat-style prompt
    const fullPrompt = [
      `<|system|>${systemPrompt}`,
      context ? `<|user|>Context:\n${context}\n\nRequest: ${prompt}` : `<|user|>${prompt}`,
      '<|assistant|>',
    ].join('\n')

    const output = await this.pipeline(fullPrompt, {
      max_new_tokens: maxTokens,
      temperature,
      do_sample: temperature > 0,
      return_full_text: false,
    })

    const result: string = Array.isArray(output)
      ? (output[0]?.generated_text ?? '')
      : (output?.generated_text ?? '')

    // Simulate streaming for UI consistency
    if (onStream) {
      const words = result.split(' ')
      for (const word of words) {
        onStream(word + ' ', false)
        await new Promise((r) => setTimeout(r, 20))
      }
      onStream('', true)
    }

    return result.trim()
  }

  destroy(): void {
    this.pipeline = null
    this._ready = false
  }
}
