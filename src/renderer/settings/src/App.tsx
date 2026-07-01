import { useState } from 'react'
import TitleBar from '@shared/components/TitleBar'
import navPalette from './assets/nav_palette.png'
import navGradient from './assets/nav_gradient.png'
import navSettings from './assets/nav_settings.png'
import PalettePage from './pages/PalettePage'
import GradientPage from './pages/GradientPage'
import SettingsPage from './pages/SettingsPage'

// Restrict the tab names
type ActiveTab = 'palette' | 'gradient' | 'settings'

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<ActiveTab>('palette')

  const pageTitle =
    activeTab === 'palette'
      ? 'Colour Palette'
      : activeTab === 'gradient'
        ? 'Colour Gradient'
        : 'Settings'

  return (
    <div className="title">
      <TitleBar title={pageTitle} onClose={() => window.api.closeSettingsWindow()} />

      <div className="main-shell">
        <nav className="side-nav">
          <div className="nav-icons">
            <button
              type="button"
              className={`nav-icon-button ${activeTab === 'palette' ? 'active' : ''}`}
              aria-label="Colour Palette"
              onClick={() => setActiveTab('palette')}
            >
              <img src={navPalette} alt="" />
            </button>

            <button
              type="button"
              className={`nav-icon-button ${activeTab === 'gradient' ? 'active' : ''}`}
              aria-label="Colour Gradient"
              onClick={() => setActiveTab('gradient')}
            >
              <img src={navGradient} alt="" />
            </button>

            <button
              type="button"
              className={`nav-icon-button ${activeTab === 'settings' ? 'active' : ''}`}
              aria-label="Settings"
              onClick={() => setActiveTab('settings')}
            >
              <img src={navSettings} alt="" />
            </button>
          </div>

          <span>v1.1</span>
        </nav>

        <main className="page-content">
          {activeTab === 'palette' && <PalettePage />}
          {activeTab === 'gradient' && <GradientPage />}
          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  )
}

export default App
