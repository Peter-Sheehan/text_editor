import { useState } from 'react'
import {
  Tag,
  ProgressBar,
  Tile,
  Button,
  Toggle,
  InlineNotification,
} from '@carbon/react'
import { ChevronDown, ChevronUp, Ai } from '@carbon/icons-react'
import { useWebLLM } from '@/context/WebLLMContext'
import styles from './styles.module.scss'

/**
 * AIPanel — collapsible sidebar panel showing LLM status, download progress,
 * and configuration controls (temperature).
 */
export function AIPanel() {
  const { isLoading, loadingProgress, loadingStatus, error, isReady, isSupported, modelId } =
    useWebLLM()
  const [expanded, setExpanded] = useState(false)
  const [predictiveEnabled, setPredictiveEnabled] = useState(true)

  const statusType = (): 'green' | 'gray' | 'blue' | 'red' => {
    if (!isSupported || error) return 'red'
    if (isReady) return 'green'
    if (isLoading) return 'blue'
    return 'gray'
  }

  const statusLabel = () => {
    if (!isSupported) return 'Unavailable'
    if (error) return 'Error'
    if (isReady) return 'Ready'
    if (isLoading) return 'Loading'
    return 'Idle'
  }

  // Short model display name
  const shortModel = modelId.replace('-q4f32_1-MLC', '').replace('-Instruct', '')

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
          <Tag type={statusType()} size="sm">
            {statusLabel()}
          </Tag>
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <Tile className={styles.body}>
          {/* Model info */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Model</p>
            <p className={styles.modelName}>{shortModel}</p>
          </div>

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

          {/* Not supported */}
          {!isSupported && (
            <div className={styles.section}>
              <p className={styles.hint}>
                Requires Chrome 113+ or Edge 113+ with WebGPU enabled.
              </p>
              <Button
                kind="ghost"
                size="sm"
                href="https://caniuse.com/webgpu"
                target="_blank"
                rel="noopener noreferrer"
              >
                Check browser support
              </Button>
            </div>
          )}
        </Tile>
      )}
    </div>
  )
}
