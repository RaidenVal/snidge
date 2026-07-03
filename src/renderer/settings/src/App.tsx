import { useEffect, useState } from 'react'
import TitleBar from '@shared/components/TitleBar'
import navPalette from './assets/nav_palette.png'
import navGradient from './assets/nav_gradient.png'
import navSettings from './assets/nav_settings.png'
import PalettePage from './pages/PalettePage'
import GradientPage from './pages/GradientPage'
import SettingsPage from './pages/SettingsPage'
import { initialSettingsTabFromLocation, type ActiveTab, isSettingsTab } from './settingsTabs'

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    initialSettingsTabFromLocation(window.location)
  )

  useEffect(() => {
    return window.api.onSettingsTabRequested((tab) => {
      if (isSettingsTab(tab)) {
        setActiveTab(tab)
      }
    })
  }, [])

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
          <div className={activeTab === 'palette' ? 'page-panel active' : 'page-panel'}>
            <PalettePage />
          </div>

          <div className={activeTab === 'gradient' ? 'page-panel active' : 'page-panel'}>
            <GradientPage />
          </div>

          <div className={activeTab === 'settings' ? 'page-panel active' : 'page-panel'}>
            <SettingsPage />
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
