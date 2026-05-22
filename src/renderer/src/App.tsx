import { useState, useEffect } from 'react'
import HotkeyInput from './components/HotkeyInput'

function App(): React.JSX.Element {
  // Initialisation, app is trying to get hotkey in store from main
  const [hotkey, setHotkey] = useState('')
  const [hasError, setHasError] = useState(false)

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

  return (
    <div className="title">
      <h2>Shortcuts</h2>
      <div className="action">
        <label>Snidge</label>
        <HotkeyInput value={hotkey} onChange={handleHotkeyChange} hasError={hasError} />
      </div>
    </div>
  )
}

export default App
