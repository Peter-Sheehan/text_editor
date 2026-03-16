/**
 * Web Worker for @huggingface/transformers inference.
 * Runs entirely off the main thread so the editor never freezes.
 */
import { pipeline, env } from '@huggingface/transformers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let generator: any = null

type WorkerMessage =
  | { type: 'init'; id: number; modelId: string }
  | { type: 'generate'; id: number; text: string; options: Record<string, unknown> }
  | { type: 'destroy' }

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data

  if (msg.type === 'init') {
    env.allowLocalModels = false

    try {
      generator = await pipeline('text-generation', msg.modelId, {
        dtype: 'q4',
        device: 'wasm',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress_callback: (data: any) => {
          self.postMessage({ type: 'progress', id: msg.id, data })
        },
      })
      self.postMessage({ type: 'ready', id: msg.id })
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, message: (err as Error).message })
    }
  }

  if (msg.type === 'generate') {
    if (!generator) {
      self.postMessage({ type: 'result', id: msg.id, error: 'Not initialized' })
      return
    }
    try {
      const output = await generator(msg.text, msg.options)
      const generated: string = Array.isArray(output)
        ? (output[0]?.generated_text ?? '')
        : (output?.generated_text ?? '')
      self.postMessage({ type: 'result', id: msg.id, generated })
    } catch (err) {
      self.postMessage({ type: 'result', id: msg.id, error: (err as Error).message })
    }
  }

  if (msg.type === 'destroy') {
    generator = null
    self.close()
  }
}
