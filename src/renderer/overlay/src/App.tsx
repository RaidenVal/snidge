import { useEffect } from "react"

function App(): React.JSX.Element {

  useEffect(() => {
    window.api
      .getScreenshot()
      .then((dataURL) => console.log('got screenshot: ', dataURL?.slice(0, 100)))
  }, [])

  return (
    <div style={{ backgroundColor: 'green', color: 'white', fontSize: '48px' }}>Hello Overlay</div>
  )
}

export default App
