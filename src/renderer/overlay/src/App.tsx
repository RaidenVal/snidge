import { useRef, useEffect } from 'react'

function App(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    window.api.getScreenshot().then((dataURL) => {
      if (!dataURL || !canvasRef.current) return
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        // Get the pen
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = window.innerWidth * window.devicePixelRatio
        canvas.height = window.innerHeight * window.devicePixelRatio

        // Paint the image (the whole canvas)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      }
      img.src = dataURL
    })
  }, [])

  return (
    <canvas ref={canvasRef} style={{ width: '100vw', height: '100vh', display: 'block' }}></canvas>
  )
}

export default App
