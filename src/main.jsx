import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import HubScreen from './hub/HubScreen.jsx'
import ErrorBoundary from './shared/components/ErrorBoundary.jsx'
import ProfileProvider from './shared/context/ProfileProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Inside the boundary, so a corrupt saved profile shows the error screen
          rather than a blank page. */}
      <ProfileProvider>
        <HubScreen />
      </ProfileProvider>
    </ErrorBoundary>
  </StrictMode>,
)
