import { useRef, useEffect, useState } from 'react'

function App(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null)
  const pickedColorRef = useRef<string | null>(null)
  const screenshotRequestedRef = useRef(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    // React StrictMode re-runs this effect in dev, and the screenshot
    // transfer is heavy, so only request the screenshot once per load
    if (screenshotRequestedRef.current) return
    screenshotRequestedRef.current = true
    window.api.getScreenshot().then((screenshot) => {
      console.log('[overlay] received screenshot bitmap')
      window.api.logOverlay('received screenshot bitmap')
      if (!screenshot || !canvasRef.current) return
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = window.innerWidth * window.devicePixelRatio
      canvas.height = window.innerHeight * window.devicePixelRatio

      const { buffer, width, height } = screenshot
      if (buffer.length !== width * height * 4) {
        window.api.logOverlay(
          `unexpected bitmap length=${buffer.length} expected=${width * height * 4}`
        )
        return
      }

      // toBitmap() hands us BGRA bytes but ImageData wants RGBA, so swap
      // red and blue; the capture is opaque so alpha is pinned to 255
      const rgba = new Uint8ClampedArray(buffer.length)
      for (let i = 0; i < buffer.length; i += 4) {
        rgba[i] = buffer[i + 2]
        rgba[i + 1] = buffer[i + 1]
        rgba[i + 2] = buffer[i]
        rgba[i + 3] = 255
      }
      const imageData = new ImageData(rgba, width, height)

      const logDrawn = (): void => {
        console.log('[overlay] image drawn to canvas')
        window.api.logOverlay('image drawn to canvas')
      }

      if (width === canvas.width && height === canvas.height) {
        // Exact pixel-for-pixel placement, same mapping the dpr math assumes
        ctx.putImageData(imageData, 0, 0)
        logDrawn()
      } else {
        // Sizes differ: scale to fill, matching the old drawImage behavior
        createImageBitmap(imageData).then((bitmap) => {
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
          logDrawn()
        })
      }
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

  function handleClick(): void {
    const hex = pickedColorRef.current
    if (!hex) return
    window.api.pickColor(hex)
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
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
