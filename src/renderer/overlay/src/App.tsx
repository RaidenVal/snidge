import { useRef, useEffect, useState } from 'react'

function App(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null)
  const pickedColorRef = useRef<string | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

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

  useEffect(() => {
    const mainCanvas = canvasRef.current
    const loupeCanvas = loupeCanvasRef.current

    if (!mainCanvas || !loupeCanvas) return

    const lctx = loupeCanvas.getContext('2d')
    if (!lctx) return

    // We need every pixel to be clear so no smoothing
    lctx.imageSmoothingEnabled = false

    // Calculate the starting point of the magnifier
    const dpr = window.devicePixelRatio
    const sourceSize = 15
    const half = Math.floor(sourceSize / 2)
    const sx = mousePosition.x * dpr - half
    const sy = mousePosition.y * dpr - half

    // 9-arg drawImage
    lctx.drawImage(mainCanvas, sx, sy, sourceSize, sourceSize, 0, 0, 120, 120)

    // Get the one single pixel to snidge
    const mainCtx = mainCanvas.getContext('2d')
    if (!mainCtx) return

    const pixel = mainCtx.getImageData(mousePosition.x * dpr, mousePosition.y * dpr, 1, 1).data

    // Transfer to hex
    const toHex = (n: number): string => n.toString(16).padStart(2, '0')
    const hex = ('#' + toHex(pixel[0]) + toHex(pixel[1]) + toHex(pixel[2])).toUpperCase()

    // Save the snidged color
    pickedColorRef.current = hex

    // Fill the center mini circle with color picked
    lctx.fillStyle = hex
    lctx.beginPath()
    lctx.arc(60, 60, 8, 0, Math.PI * 2)
    lctx.fill()

    // Add stroke for the picked color pixel
    lctx.strokeStyle = 'white'
    lctx.lineWidth = 1
    lctx.stroke()
  }, [mousePosition])

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>): void {
    setMousePosition({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        style={{ width: '100vw', height: '100vh', display: 'block' }}
      />
      <canvas
        ref={loupeCanvasRef}
        width={120}
        height={120}
        style={{
          position: 'absolute',
          top: mousePosition.y - 60,
          left: mousePosition.x - 60,
          width: 120,
          height: 120,
          pointerEvents: 'none'
        }}
      />
    </>
  )
}

export default App
