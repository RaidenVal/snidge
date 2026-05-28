import { useEffect, useState, useRef } from 'react'
import { generatePalette } from './colorMath'

function App(): React.JSX.Element {
  const [hex, setHex] = useState<string | null>(null)
  const [count, setCount] = useState<number>(10)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    window.api.getPickedColor().then((dataHex: string | null) => {
      if (!dataHex) return
      setHex(dataHex)
    })
  }, [])

  useEffect(() => {
    if (!hex) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const cx = 200
    const cy = 200
    const innerR = 90
    const outerR = 180
    const midR = (innerR + outerR) / 2
    const ringWidth = outerR - innerR
    const centerRadius = 40

    const palette = generatePalette(hex, count)

    const wedgeAngle = (2 * Math.PI) / count // Angle of each sector
    const topAngle = -Math.PI / 2 // 12 o'clock position
    const wedgeGap = 0.04 // Smallest gap between the sectors

    const half = count / 2

    function drawPetal(
      ctx: CanvasRenderingContext2D,
      color: string,
      startAngle: number,
      endAngle: number
    ): void {
      ctx.beginPath()
      ctx.arc(cx, cy, midR, startAngle, endAngle)
      ctx.lineWidth = ringWidth
      ctx.lineCap = 'butt'
      ctx.strokeStyle = color
      ctx.stroke()
    }

    for (let i = 0; i < half; i++) {
      const start = topAngle + i * wedgeAngle + wedgeGap / 2
      const end = topAngle + (i + 1) * wedgeAngle - wedgeGap / 2
      drawPetal(ctx, palette.darker[half - 1 - i], start, end)
    }

    for (let i = 0; i < half; i++) {
      const start = topAngle - (i + 1) * wedgeAngle + wedgeGap / 2
      const end = topAngle - i * wedgeAngle - wedgeGap / 2
      drawPetal(ctx, palette.lighter[half - 1 - i], start, end)
    }

    ctx.fillStyle = palette.center
    ctx.beginPath()
    ctx.arc(cx, cy, centerRadius, 0, 2 * Math.PI)
    ctx.fill()
  }, [hex, count])

  return (
    <>
      <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
        <option value={6}>6</option>
        <option value={10}>10</option>
        <option value={20}>20</option>
      </select>
      <canvas ref={canvasRef} width={400} height={400} />
    </>
  )
}

export default App
