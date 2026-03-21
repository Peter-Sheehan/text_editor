import { Theme } from '@carbon/react'
import { Editor } from '@/components/Editor'
import { WebLLMProvider } from '@/context/WebLLMContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AIPanel } from '@/components/AIPanel'
import styles from './app.module.scss'

function AppContent() {
  return (
    <div className={styles.app}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>Text Editor</h1>
          <div className={styles.aiPanelWrapper}>
            <AIPanel />
          </div>
        </header>

        {/* Editor */}
        <main className={styles.main}>
          <Editor />
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Theme theme="g100">
        <WebLLMProvider>
          <AppContent />
        </WebLLMProvider>
      </Theme>
    </ErrorBoundary>
  )
}

export default App
