import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import HubScreen from './hub/HubScreen.jsx'
import ErrorBoundary from './shared/components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HubScreen />
    </ErrorBoundary>
  </StrictMode>,
)
