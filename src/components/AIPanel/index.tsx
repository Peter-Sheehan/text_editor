import { useState } from 'react'
import {
  Tag,
  ProgressBar,
  Tile,
  Toggle,
  InlineNotification,
} from '@carbon/react'
import { ChevronDown, ChevronUp, Ai } from '@carbon/icons-react'
import { useWebLLM } from '@/context/WebLLMContext'
import styles from './styles.module.scss'

/**
 * AIPanel — collapsible sidebar panel showing LLM status, backend type,
 * download progress, and configuration controls.
 */
export function AIPanel() {
  const { isLoading, loadingProgress, loadingStatus, error, isReady, modelId, backend } =
    useWebLLM()
  const [expanded, setExpanded] = useState(false)
  const [predictiveEnabled, setPredictiveEnabled] = useState(true)

  const statusType = (): 'green' | 'blue' | 'red' => {
    if (error) return 'red'
    if (isReady) return 'green'
    return 'blue'
  }

  const statusLabel = () => {
    if (error) return 'Error'
    if (isReady) return 'Ready'
    if (isLoading) return 'Loading'
    return 'Starting'
  }

  // Short model display name — strip ONNX/quantisation suffixes
  const shortModel = modelId
    .replace('-q4f32_1-MLC', '')
    .replace('-Instruct', '')
    .split('/').pop() ?? modelId

  const backendLabel = backend === 'webgpu' ? 'GPU' : backend === 'cpu' ? 'CPU' : null

  return (
    <div className={styles.panel}>
      {/* Compact header — always visible */}
      <button
        className={styles.header}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={styles.headerLeft}>
          <Ai size={16} />
          <span className={styles.headerTitle}>AI</span>
          <Tag type={statusType()} size="sm">{statusLabel()}</Tag>
          {backendLabel && <Tag type="outline" size="sm">{backendLabel}</Tag>}
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <Tile className={styles.body}>
          {/* Model info */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Model</p>
            <p className={styles.modelName}>{shortModel || '—'}</p>
          </div>

          {/* Backend info */}
          {backend && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Backend</p>
              <p className={styles.hint}>
                {backend === 'webgpu'
                  ? 'WebGPU (GPU accelerated)'
                  : 'WebAssembly (CPU — works on all browsers)'}
              </p>
            </div>
          )}

          {/* Loading progress */}
          {isLoading && (
            <div className={styles.section}>
              <ProgressBar
                label={loadingStatus}
                value={loadingProgress}
                max={100}
                size="small"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className={styles.section}>
              <InlineNotification
                kind="error"
                title="AI Error"
                subtitle={error}
                lowContrast
                hideCloseButton
              />
            </div>
          )}

          {/* Ready state */}
          {isReady && (
            <>
              <div className={styles.section}>
                <Toggle
                  id="predictive-toggle"
                  labelText="Predictive text"
                  labelA="Off"
                  labelB="On"
                  toggled={predictiveEnabled}
                  onToggle={setPredictiveEnabled}
                  size="sm"
                />
              </div>
              <div className={styles.section}>
                <p className={styles.hint}>
                  <kbd>Tab</kbd> accept &nbsp;·&nbsp; <kbd>Esc</kbd> dismiss &nbsp;·&nbsp;{' '}
                  <kbd>⌘J</kbd> Ask AI
                </p>
              </div>
            </>
          )}
        </Tile>
      )}
    </div>
  )
}
