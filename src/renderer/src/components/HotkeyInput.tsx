import { useState, useEffect } from 'react'
import resetButton from '../assets/reset_button.png'

interface Props {
  value: string
  onChange: (newValue: string) => void
  hasError?: boolean
}

function HotkeyInput({ value, onChange }: Props): React.JSX.Element {
  const [isListening, setIsListening] = useState(false)

  useEffect(() => {
    // Do nothing if not listening
    if (!isListening) return

    function handleKeyDown(e: KeyboardEvent): void {
      e.preventDefault()

      // Use Esc to cancel
      if (e.key === 'Escape') {
        setIsListening(false)
        return
      }

      // Verification: there should be at least 1 modifier + 1 letter
      const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey
      const isLetter = /^[a-zA-Z]$/.test(e.key)
      // Verification failed - stay listening
      if (!hasModifier || !isLetter) return

      const parts: string[] = []
      // e.xxkey - is this key pressed? If so, add it to parts
      // metaKey: cmd or win key
      if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      // Convert the single letter key to uppercase
      parts.push(e.key.toUpperCase())

      onChange(parts.join('+'))
      // Exit listening
      setIsListening(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isListening, onChange])

  const buttonDisplay = value
    .toLowerCase()
    .replace('commandorcontrol', 'ctrl')
    .replace(/\+/g, ' + ')

  return (
    <div className="hotkey-row">
      <button
        type="button"
        // If listening, class name is hotkey-input listening
        // If not, class name is hotkey-input
        className={`hotkey-input ${isListening ? 'listening' : ''}`}
        onClick={() => setIsListening(true)}
      >
        {isListening ? 'Enter New Shortcut' : buttonDisplay}
      </button>
      <button
        type="button"
        className="reset-button"
        onClick={() => onChange('CommandOrControl+Alt+S')}
      >
        <img src={resetButton} alt="Reset" />
      </button>
      {isListening && <small className="hint">Press Esc to cancel</small>}
    </div>
  )
}

export default HotkeyInput
