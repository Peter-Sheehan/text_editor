/**
 * Web Worker for @huggingface/transformers inference.
 * Runs entirely off the main thread so the editor never freezes.
 */
import { pipeline, env } from '@huggingface/transformers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let generator: any = null

type ChatMessage = { role: string; content: string }

type WorkerMessage =
  | { type: 'init'; id: number; modelId: string }
  | {
      type: 'generate'
      id: number
      /** Raw text prompt (legacy / backward-compat) */
      text?: string
      /** Structured chat messages — tokenizer applies the correct chat template */
      messages?: ChatMessage[]
      options: Record<string, unknown>
    }
  | { type: 'destroy' }

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data

  if (msg.type === 'init') {
    env.allowLocalModels = false

    try {
      // Larger context window helps the model stay on topic
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
      // Prefer structured messages (model-agnostic chat template applied by tokenizer).
      // Fall back to raw text for backward compatibility.
      const input = msg.messages ?? msg.text
      const output = await generator(input, msg.options)

      const raw = Array.isArray(output)
        ? output[0]?.generated_text
        : output?.generated_text

      let generated: string
      if (typeof raw === 'string') {
        // Raw text input path: generated_text is the full completion string
        generated = raw
      } else if (Array.isArray(raw)) {
        // Chat messages input path: generated_text is the messages array;
        // the last entry is the assistant reply
        generated = (raw.at(-1) as ChatMessage | undefined)?.content ?? ''
      } else {
        console.warn('[transformers.worker] unexpected output shape:', output)
        generated = ''
      }

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
