import { Theme, Tag } from '@carbon/react'
import { Editor } from '@/components/Editor'
import { WebLLMProvider, useWebLLM } from '@/context/WebLLMContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'

function AppContent() {
  const { isReady, isSupported } = useWebLLM()

  const getTagType = (): 'green' | 'gray' | 'blue' => {
    if (!isSupported) return 'gray'
    if (isReady) return 'green'
    return 'blue'
  }

  const getStatusText = () => {
    if (!isSupported) return 'AI Unavailable'
    if (isReady) return 'AI Ready'
    return 'AI Loading...'
  }

  return (
    <div className="app">
      <div className="app-container">
        <div className="app-header">
          <h1 className="app-title">Text Editor</h1>
          <Tag type={getTagType()} size="sm">
            {getStatusText()}
          </Tag>
        </div>
        <p className="app-instructions">
          Type <kbd>/</kbd> for commands
          {isSupported && (
            <>
              {' | '}
              <kbd>Cmd+J</kbd> to ask AI
              {' | '}
              <kbd>Tab</kbd> to accept suggestions
            </>
          )}
        </p>
        <Editor />
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
