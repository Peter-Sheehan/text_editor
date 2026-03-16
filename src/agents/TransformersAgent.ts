import type { AIAgent, ProgressCallback, PredictiveCompletionOptions, GenerateTextOptions } from './types'

export const DEFAULT_TRANSFORMERS_MODEL = 'HuggingFaceTB/SmolLM2-135M-Instruct'

/**
 * CPU-based inference agent using @huggingface/transformers (WASM/ONNX).
 * Inference runs entirely in a Web Worker — the main thread is never blocked.
 */
export class TransformersAgent implements AIAgent {
  private worker: Worker | null = null
  private _modelId: string
  private _ready = false
  private pendingCallbacks = new Map<number, (result: string, error?: string) => void>()
  private nextId = 1

  constructor(modelId = DEFAULT_TRANSFORMERS_MODEL) {
    this._modelId = modelId
  }

  get ready() { return this._ready }
  get modelId() { return this._modelId }

  initialize(onProgress?: ProgressCallback): Promise<void> {
    return new Promise((resolve, reject) => {
      // Vite worker import — runs in its own thread
      this.worker = new Worker(
        new URL('../workers/transformers.worker.ts', import.meta.url),
        { type: 'module' }
      )

      const id = this.nextId++

      this.worker.onmessage = (event) => {
        const msg = event.data

        if (msg.type === 'progress' && msg.id === id) {
          const { data } = msg
          if (data.status === 'progress' && typeof data.progress === 'number') {
            onProgress?.(Math.round(data.progress), `Downloading ${data.file ?? 'model'}…`)
          } else if (data.status === 'initiate') {
            onProgress?.(0, `Loading ${data.file ?? 'model'}…`)
          } else if (data.status === 'done') {
            onProgress?.(100, 'Model ready')
          }
          return
        }

        if (msg.type === 'ready' && msg.id === id) {
          this._ready = true
          resolve()
          return
        }

        if (msg.type === 'error' && msg.id === id) {
          reject(new Error(msg.message))
          return
        }

        // Resolve a pending generate call
        if (msg.type === 'result') {
          const cb = this.pendingCallbacks.get(msg.id)
          if (cb) {
            this.pendingCallbacks.delete(msg.id)
            cb(msg.generated ?? '', msg.error)
          }
        }
      }

      this.worker.onerror = (err) => reject(new Error(err.message))

      this.worker.postMessage({ type: 'init', id, modelId: this._modelId })
    })
  }

  private callWorker(text: string, options: Record<string, unknown>): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.worker) return reject(new Error('Worker not running'))
      const id = this.nextId++
      this.pendingCallbacks.set(id, (result, error) => {
        if (error) reject(new Error(error))
        else resolve(result)
      })
      this.worker.postMessage({ type: 'generate', id, text, options })
    })
  }

  async predictiveComplete(textBefore: string, options: PredictiveCompletionOptions = {}): Promise<string> {
    if (!this._ready) throw new Error('TransformersAgent not initialized')
    const { maxTokens = 30, temperature = 0.6, contextWindow = 200 } = options
    const context = textBefore.slice(-contextWindow)

    // Wrap in a minimal instruction so the model stays on topic
    const prompt =
      `<|system|>You are a predictive text assistant. Complete the text below naturally, staying strictly on the same topic. Output ONLY the completion. Max 1 sentence.\n` +
      `<|user|>Continue this text:\n${context}\n<|assistant|>`

    const generated = await this.callWorker(prompt, {
      max_new_tokens: maxTokens,
      temperature,
      do_sample: temperature > 0,
      return_full_text: false,
    })

    // Only return up to the first sentence boundary
    return generated.split(/(?<=[.!?])\s/)[0]?.trim() ?? ''
  }

  async generateText(prompt: string, options: GenerateTextOptions = {}): Promise<string> {
    if (!this._ready) throw new Error('TransformersAgent not initialized')

    const {
      systemPrompt = 'You are a helpful writing assistant.',
      context,
      maxTokens = 200,
      temperature = 0.7,
      onStream,
    } = options

    const fullPrompt = [
      `<|system|>${systemPrompt}`,
      context ? `<|user|>Context:\n${context}\n\nRequest: ${prompt}` : `<|user|>${prompt}`,
      '<|assistant|>',
    ].join('\n')

    const result = await this.callWorker(fullPrompt, {
      max_new_tokens: maxTokens,
      temperature,
      do_sample: temperature > 0,
      return_full_text: false,
    })

    // Simulate streaming word-by-word for UI consistency (worker already returned full result)
    if (onStream) {
      for (const word of result.split(' ')) {
        onStream(word + ' ', false)
        await new Promise((r) => setTimeout(r, 15))
      }
      onStream('', true)
    }

    return result.trim()
  }

  destroy(): void {
    this.worker?.postMessage({ type: 'destroy' })
    this.worker?.terminate()
    this.worker = null
    this._ready = false
    this.pendingCallbacks.clear()
  }
}
