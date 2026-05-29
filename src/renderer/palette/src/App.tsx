import { useEffect, useState, useRef } from 'react'
import { generatePalette, hexToRgb, rgbToCmyk } from './colorMath'
import TitleBar from '@renderer/components/TitleBar'

function App(): React.JSX.Element {
  const [hex, setHex] = useState<string | null>(null)
  const [count, setCount] = useState<number>(10)
  const [activeColor, setActiveColor] = useState<string | null>(null)
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    window.api.getPickedColor().then((dataHex: string | null) => {
      if (!dataHex) return
      setHex(dataHex)
      setActiveColor(dataHex)
    })
  }, [])

  useEffect(() => {
    if (!hex) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const cx = 160
    const cy = 160
    const innerR = 72
    const outerR = 144
    const midR = (innerR + outerR) / 2
    const ringWidth = outerR - innerR
    const centerRadius = 32

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

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>): void {
    if (!hex) return

    // Get the relative coordinates of the click (to the top left of the canvas)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Get the polar coordinates
    const cx = 160,
      cy = 160
    const innerR = 72,
      outerR = 144,
      centerRadius = 32
    const dx = x - cx
    const dy = y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Judge the position (center? wedge? gap?)
    if (dist <= centerRadius) {
      // Go back to the picked color if clicking on the center
      setActiveColor(hex)
      return
    }
    if (dist < innerR || dist > outerR) return

    let angle = Math.atan2(dy, dx) + Math.PI / 2
    if (angle < 0) angle += 2 * Math.PI

    const palette = generatePalette(hex, count)
    const half = count / 2
    const wedgeAngle = (2 * Math.PI) / count

    let newColor: string
    if (angle <= Math.PI) {
      const i = Math.floor(angle / wedgeAngle)
      newColor = palette.darker[half - 1 - i]
    } else {
      const reverse = 2 * Math.PI - angle
      const i = Math.floor(reverse / wedgeAngle)
      newColor = palette.lighter[half - 1 - i]
    }
    setActiveColor(newColor)
  }

  function copyToClipboard(format: string, text: string): void {
    navigator.clipboard.writeText(text)
    setCopiedFormat(format)
    setTimeout(() => setCopiedFormat(null), 2000)
  }

  const rgb = activeColor ? hexToRgb(activeColor) : null
  const cmyk = rgb ? rgbToCmyk(rgb.r, rgb.g, rgb.b) : null

  return (
    <>
      <TitleBar title="Colour Palette" onClose={() => window.api.closePaletteWindow()} />

      <div className="palette-body">
        <canvas ref={canvasRef} width={320} height={320} onClick={handleClick} />

        <div className="palette-right">
          {/*Dropdown menu*/}

          <div className="pill coral">
            <span className="label-white">Colour tone amount</span>
            <select
              className="amount-select"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              <option value={6}>6</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>

          {/*Three color schemes*/}

          <div className="pill">
            <span className="label">HEX</span>
            <span className="value">{activeColor ?? '--'}</span>
            <button className="copy-btn" onClick={() => copyToClipboard('hex', activeColor ?? '')}>
              {copiedFormat === 'hex' ? '✓' : '⧉'}
            </button>
          </div>

          <div className="pill">
            <span className="label">RGB</span>
            <span className="value">{rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '--'}</span>
            <button
              className="copy-btn"
              onClick={() => copyToClipboard('rgb', rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '')}
            >
              {copiedFormat === 'rgb' ? '✓' : '⧉'}
            </button>
          </div>

          <div className="pill">
            <span className="label">CMYK</span>
            <span className="value">{cmyk ? `${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}` : '--'}</span>
            <button
              className="copy-btn"
              onClick={() =>
                copyToClipboard('cmyk', cmyk ? `${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}` : '')
              }
            >
              {copiedFormat === 'cmyk' ? '✓' : '⧉'}
            </button>
          </div>

          {/*Save Button*/}

          <button className="coral-btn" onClick={() => console.log('Save stub - Phase 6')}>
            Save colour palette
          </button>

          {/*Repick and Cancel Button*/}

          <div className="btn-row">
            <button className="coral-btn" onClick={() => window.api.repick()}>Repick</button>
            <button className="coral-btn" onClick={() => window.api.closePaletteWindow()}>Cancel</button>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
