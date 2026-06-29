import { useState, useEffect } from 'react'
import HotkeyInput from './components/HotkeyInput'
import TitleBar from '@shared/components/TitleBar'
import navPalette from './assets/nav_palette.png'
import navGradient from './assets/nav_gradient.png'
import navSettings from './assets/nav_settings.png'

// Restrict the tab names
type ActiveTab = 'palette' | 'gradient' | 'settings'

function App(): React.JSX.Element {
  // Initialisation, app is trying to get hotkey in store from main
  const [hotkey, setHotkey] = useState('')
  const [hasError, setHasError] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('palette')

  useEffect(() => {
    // "current" here is the hotkey got from main
    window.api.getHotkey().then((current) => setHotkey(current))
    // Empty [] means this runs only once
  }, [])

  async function handleHotkeyChange(newHotkey: string): Promise<void> {
    setHotkey(newHotkey)
    const result = await window.api.setHotkey(newHotkey)
    setHasError(!result.success)
  }

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
          {activeTab === 'palette' && (
            <>
              <h2>Oi~ Time to Snidge</h2>
              <div className="action">
                <button type="button">Pick Colour</button>
              </div>
            </>
          )}

          {activeTab === 'gradient' && (
            <>
              <h2>Oi~ Time to Snidge</h2>
              <div className="action">
                <button type="button">Pick Colour A</button>
              </div>
            </>
          )}

          {activeTab === 'settings' && (
            <>
              <h2>Shortcuts</h2>
              <div className="action">
                <label>Snidge</label>
                <HotkeyInput value={hotkey} onChange={handleHotkeyChange} hasError={hasError} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
