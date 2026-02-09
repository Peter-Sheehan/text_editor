import { InlineNotification, Button } from '@carbon/react'

interface FallbackUIProps {
  error: Error
  onReset: () => void
}

export function FallbackUI({ error, onReset }: FallbackUIProps) {
  return (
    <div style={{ padding: '2rem', maxWidth: '56rem', margin: '0 auto' }}>
      <InlineNotification
        kind="error"
        title="Something went wrong"
        subtitle={error.message || 'An unexpected error occurred'}
        lowContrast
      />
      <div style={{ marginTop: '1rem' }}>
        <Button onClick={onReset}>Try again</Button>
      </div>
    </div>
  )
}
