import { useState, useEffect } from 'react'
import HotkeyInput from './components/HotkeyInput'
import TitleBar from '@shared/components/TitleBar'
import navPalette from './assets/nav_palette.png'
import navGradient from './assets/nav_gradient.png'
import navSettings from './assets/nav_settings.png'
import snidgeCatPaletteEntry from './assets/snidge_cat_palette_entry.png'
import { hexToRgb, rgbToCmyk } from '../../palette/src/colorMath'
import copyIcon from '../../palette/src/assets/copy.png'
import copyDoneIcon from '../../palette/src/assets/copydone.png'

// Restrict the tab names
type ActiveTab = 'palette' | 'gradient' | 'settings'

function App(): React.JSX.Element {
  // Initialisation, app is trying to get hotkey in store from main
  const [hotkey, setHotkey] = useState('')
  const [hasError, setHasError] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('palette')
  const [count, setCount] = useState(10)
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)

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

  function copyToClipboard(format: string, text: string): void {
    navigator.clipboard.writeText(text)
    setCopiedFormat(format)
    setTimeout(() => setCopiedFormat(null), 2000)
  }

  const isPaletteEntry = true
  const paletteColor = '#FFFFFF'
  const paletteRgb = hexToRgb(paletteColor)
  const paletteCmyk = paletteRgb ? rgbToCmyk(paletteRgb.r, paletteRgb.g, paletteRgb.b) : null

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
            <section className="capture-body">
              <button
                type="button"
                className="capture-cat-button"
                aria-label="Start colour capture"
                onClick={() => window.api.startCapture('palette')}
              >
                <img src={snidgeCatPaletteEntry} alt="" />
              </button>

              <div className="capture-right">
                <div className="pill coral">
                  <span className="label-white">Colour tone amount</span>
                  <select
                    className="amount-select"
                    value={count}
                    disabled={isPaletteEntry}
                    onChange={(e) => setCount(Number(e.target.value))}
                  >
                    <option value={6}>6</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>

                <div className="pill">
                  <span className="label">HEX</span>
                  <span className="value">{paletteColor}</span>
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() => copyToClipboard('hex', paletteColor)}
                  >
                    <img src={copiedFormat === 'hex' ? copyDoneIcon : copyIcon} alt="Copy" />
                  </button>
                </div>

                <div className="pill">
                  <span className="label">RGB</span>
                  <span className="value">
                    {paletteRgb ? `${paletteRgb.r}, ${paletteRgb.g}, ${paletteRgb.b}` : '--'}
                  </span>
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() =>
                      copyToClipboard(
                        'rgb',
                        paletteRgb ? `${paletteRgb.r}, ${paletteRgb.g}, ${paletteRgb.b}` : ''
                      )
                    }
                  >
                    <img src={copiedFormat === 'rgb' ? copyDoneIcon : copyIcon} alt="Copy" />
                  </button>
                </div>

                <div className="pill">
                  <span className="label">CMYK</span>
                  <span className="value">
                    {paletteCmyk
                      ? `${paletteCmyk.c}, ${paletteCmyk.m}, ${paletteCmyk.y}, ${paletteCmyk.k}`
                      : '--'}
                  </span>
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() =>
                      copyToClipboard(
                        'cmyk',
                        paletteCmyk
                          ? `${paletteCmyk.c}, ${paletteCmyk.m}, ${paletteCmyk.y}, ${paletteCmyk.k}`
                          : ''
                      )
                    }
                  >
                    <img src={copiedFormat === 'cmyk' ? copyDoneIcon : copyIcon} alt="Copy" />
                  </button>
                </div>

                <button type="button" className="coral-btn" disabled={isPaletteEntry}>
                  Save colour palette
                </button>

                <div className="btn-row">
                  <button type="button" className="coral-btn" disabled={isPaletteEntry}>
                    Repick
                  </button>
                  <button type="button" className="coral-btn" disabled={isPaletteEntry}>
                    Cancel
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'gradient' && (
            <section className="capture-body">
              <button
                type="button"
                className="capture-cat-button"
                aria-label="Start gradient colour capture"
                onClick={() => console.log('gradient colour A capture clicked')}
              >
                <img src={snidgeCatPaletteEntry} alt="" />
              </button>

              <div className="capture-right">
                <div className="pill coral">
                  <span className="label-white">Colour tone amount</span>
                  <select className="amount-select" value={9} disabled>
                    <option value={4}>4</option>
                    <option value={9}>9</option>
                    <option value={16}>16</option>
                  </select>
                </div>

                <div className="pill">
                  <span className="label">HEX</span>
                  <span className="value">{paletteColor}</span>
                  <button type="button" className="copy-btn">
                    <img src={copyIcon} alt="Copy" />
                  </button>
                </div>

                <div className="pill">
                  <span className="label">RGB</span>
                  <span className="value">
                    {paletteRgb ? `${paletteRgb.r}, ${paletteRgb.g}, ${paletteRgb.b}` : '--'}
                  </span>
                  <button type="button" className="copy-btn">
                    <img src={copyIcon} alt="Copy" />
                  </button>
                </div>

                <div className="pill">
                  <span className="label">CMYK</span>
                  <span className="value">
                    {paletteCmyk
                      ? `${paletteCmyk.c}, ${paletteCmyk.m}, ${paletteCmyk.y}, ${paletteCmyk.k}`
                      : '--'}
                  </span>
                  <button type="button" className="copy-btn">
                    <img src={copyIcon} alt="Copy" />
                  </button>
                </div>

                <button type="button" className="coral-btn" disabled>
                  Save colour palette
                </button>

                <div className="btn-row">
                  <button type="button" className="coral-btn" disabled>
                    Repick
                  </button>
                  <button type="button" className="coral-btn" disabled>
                    Cancel
                  </button>
                </div>
              </div>
            </section>
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
