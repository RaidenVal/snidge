import { useEffect, useState, useRef } from 'react'
import { generatePalette, hexToRgb, rgbToCmyk } from './colorMath'
import TitleBar from '@shared/components/TitleBar'
import copyIcon from './assets/copy.png'
import copyDoneIcon from './assets/copydone.png'

function App(): React.JSX.Element {
  const [hex, setHex] = useState<string | null>(null)
  const [count, setCount] = useState<number>(10)
  const [activeColor, setActiveColor] = useState<string | null>(null)
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    window.api.getPickedColor().then((dataHex: string | null) => {
      if (!dataHex) return
      setHex(dataHex)
      setActiveColor(dataHex)
    })
  }, [])

  function copyToClipboard(format: string, text: string): void {
    navigator.clipboard.writeText(text)
    setCopiedFormat(format)
    setTimeout(() => setCopiedFormat(null), 2000)
  }

  const rgb = activeColor ? hexToRgb(activeColor) : null
  const cmyk = rgb ? rgbToCmyk(rgb.r, rgb.g, rgb.b) : null

  // From here we are using svg instead of canvas
  // Because canvas can not shape each piece of the petal individually
  // Or give them different functions or effects

  // Make a circle, whose center point is at (160, 160)
  // With a radius of 140
  const cx = 160,
    cy = 160,
    R = 140,
    Ri = 40

  // Input an angle and output a coordinate point at the circle
  function pt(angle: number, radius: number = R): { x: number; y: number } {
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
  }

  // a. Move to the center of the circle
  // b. Draw a line to a point on the outer edge
  // c. Draw an arc to another point on the outer edge
  // d. Finish
  function sectorPath(start: number, end: number): string {
    const r = 22
    const dO = r / R
    const dI = r / Ri

    const o1rad = pt(start, R - r)
    const o1 = pt(start, R)
    const o1arc = pt(start + dO, R)
    const o2arc = pt(end - dO, R)
    const o2 = pt(end, R)
    const o2rad = pt(end, R - r)

    const i2rad = pt(end, Ri + r)
    const i2 = pt(end, Ri)
    const i2arc = pt(end - dI, Ri)
    const i1arc = pt(start + dI, Ri)
    const i1 = pt(start, Ri)
    const i1rad = pt(start, Ri + r)

    return `M ${i1rad.x} ${i1rad.y}
            L ${o1rad.x} ${o1rad.y}
            Q ${o1.x} ${o1.y} ${o1arc.x} ${o1arc.y}
            A ${R} ${R} 0 0 1 ${o2arc.x} ${o2arc.y}
            Q ${o2.x} ${o2.y} ${o2rad.x} ${o2rad.y}
            L ${i2rad.x} ${i2rad.y}
            Q ${i2.x} ${i2.y} ${i2arc.x} ${i2arc.y}
            A ${Ri} ${Ri} 0 0 0 ${i1arc.x} ${i1arc.y}
            Q ${i1.x} ${i1.y} ${i1rad.x} ${i1rad.y}
            Z`
  }

  const top = -Math.PI / 2 // The very top coordinate of the circle
  const wedge = (2 * Math.PI) / count // The angle of each petal

  const palette = hex ? generatePalette(hex, count) : null
  const colors = palette ? palette.lighter.slice().reverse().concat(palette.darker) : []

  async function exportPng(): Promise<string | null> {
    const svg = svgRef.current
    if (!svg) return null

    // 1. Translate svg into XML texts
    const xml = new XMLSerializer().serializeToString(svg)
    // Wrap it up into an image address
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)

    // 2. Load this address into an image (need to wait)
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = svgUrl
    })

    // 3. Paint this image to a temparory and invisible canvas
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 320
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, 320, 320)

    // 4. Canvas output PNG
    return canvas.toDataURL('image/png')
  }

  return (
    <>
      <TitleBar title="Colour Palette" onClose={() => window.api.closePaletteWindow()} />

      <div className="palette-body">
        <svg ref={svgRef} width={320} height={320} viewBox="0 0 320 320">
          <circle cx={160} cy={160} r={150} fill="#ffffff" />
          {/*Make number of count of empty spaces*/}
          {/*Make each of the spaces to a <path>*/}
          {Array.from({ length: count }).map((_, i) => {
            {
              /*i is the No. i petal*/
              /*start and end are start and end angles*/
              /*起（始）角度 = 这片的第一条边在哪个角度（一条切线）*/
              /*止（终）角度 = 这片的第二条边在哪个角度（下一条切线）*/
            }
            const start = top + i * wedge
            const end = start + wedge
            return (
              /*Draw the petal using <path>*/
              <path
                key={i}
                d={sectorPath(start, end)}
                fill={colors[i] ?? '#dddddd'}
                stroke="#ffffff"
                strokeWidth={8}
                onClick={() => setActiveColor(colors[i])}
                style={{ cursor: 'pointer' }}
              />
            )
          })}
          <circle
            cx={160}
            cy={160}
            r={33}
            fill={hex ?? '#dddddd'}
            onClick={() => setActiveColor(hex)}
            style={{ cursor: 'pointer' }}
          />
        </svg>

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
              <img src={copiedFormat === 'hex' ? copyDoneIcon : copyIcon} alt="Copy" />
            </button>
          </div>

          <div className="pill">
            <span className="label">RGB</span>
            <span className="value">{rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '--'}</span>
            <button
              className="copy-btn"
              onClick={() => copyToClipboard('rgb', rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '')}
            >
              <img src={copiedFormat === 'rgb' ? copyDoneIcon : copyIcon} alt="Copy" />
            </button>
          </div>

          <div className="pill">
            <span className="label">CMYK</span>
            <span className="value">
              {cmyk ? `${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}` : '--'}
            </span>
            <button
              className="copy-btn"
              onClick={() =>
                copyToClipboard('cmyk', cmyk ? `${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}` : '')
              }
            >
              <img src={copiedFormat === 'cmyk' ? copyDoneIcon : copyIcon} alt="Copy" />
            </button>
          </div>

          {/*Save Button*/}

          <button
            className="coral-btn"
            onClick={async () => {
              const dataURL = await exportPng()
              if (!dataURL) return
              const result = await window.api.savePng(dataURL, 'palette')
              if (result.success) {
                console.log('Save to: ', result.path)
              } else if (result.canceled) {
                console.log('Save canceled')
              } else {
                console.error('Save failed')
              }
            }}
          >
            Save colour palette
          </button>

          {/*Repick and Cancel Button*/}

          <div className="btn-row">
            <button className="coral-btn" onClick={() => window.api.repick()}>
              Repick
            </button>
            <button className="coral-btn" onClick={() => window.api.closePaletteWindow()}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
