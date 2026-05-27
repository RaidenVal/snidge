import { useEffect, useState } from "react"

function App(): React.JSX.Element {
  const [hex, setHex] = useState<string | null>(null)

  useEffect(() => {
    window.api.getPickedColor().then(setHex)
  }, [])

  return (
    <div style={{ backgroundColor: 'lightyellow', padding: 20 }}>
      Picked: {hex ?? 'loading... '}
    </div>
  )
}

export default App
