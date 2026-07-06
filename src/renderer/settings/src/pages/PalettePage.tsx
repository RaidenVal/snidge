import { useEffect, useRef, useState } from 'react'
import snidgeCatPaletteEntry from '../assets/snidge_cat_palette_entry.png'
import copyIcon from '../../../palette/src/assets/copy.png'
import copyDoneIcon from '../../../palette/src/assets/copydone.png'
import { generatePalette, hexToRgb, rgbToCmyk } from '../../../palette/src/colorMath'
import { blurFocusedElement } from '../focus'

function PalettePage(): React.JSX.Element {
  const [count, setCount] = useState(10)
  const [paletteColor, setPaletteColor] = useState<string | null>(null)
  const [activeColor, setActiveColor] = useState<string | null>(null)
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    return window.api.onPaletteColorPicked((hex) => {
      blurFocusedElement()
      setPaletteColor(hex)
      setActiveColor(hex)
    })
  }, [])

  function copyToClipboard(format: string, text: string): void {
    navigator.clipboard.writeText(text)
    setCopiedFormat(format)
    setTimeout(() => setCopiedFormat(null), 2000)
  }

  async function exportPng(): Promise<string | null> {
    const svg = svgRef.current
    if (!svg) return null

    const xml = new XMLSerializer().serializeToString(svg)
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)

    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = svgUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 320
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(img, 0, 0, 320, 320)
    return canvas.toDataURL('image/png')
  }

  function handleCancel(): void {
    setPaletteColor(null)
    setActiveColor(null)
  }

  const isPaletteEntry = paletteColor === null
  const displayColor = activeColor ?? '#FFFFFF'
  const paletteRgb = hexToRgb(displayColor)
  const paletteCmyk = paletteRgb ? rgbToCmyk(paletteRgb.r, paletteRgb.g, paletteRgb.b) : null

  const palette = paletteColor ? generatePalette(paletteColor, count) : null
  const colors = palette ? palette.lighter.slice().reverse().concat(palette.darker) : []

  const cx = 160
  const cy = 160
  const R = 140
  const Ri = 40
  const top = -Math.PI / 2
  const wedge = (2 * Math.PI) / count

  function pt(angle: number, radius: number = R): { x: number; y: number } {
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
  }

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

  return (
    <section className="capture-body">
      {isPaletteEntry ? (
        <button
          type="button"
          className="capture-cat-button"
          aria-label="Start colour capture"
          onClick={() => window.api.startCapture('palette')}
        >
          <img src={snidgeCatPaletteEntry} alt="" />
        </button>
      ) : (
        <div className="palette-result-left">
          <svg
            ref={svgRef}
            className="palette-wheel"
            width={320}
            height={320}
            viewBox="0 0 320 320"
          >
            <circle cx={160} cy={160} r={150} fill="#ffffff" />
            {Array.from({ length: count }).map((_, i) => {
              const start = top + i * wedge
              const end = start + wedge

              return (
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
              fill={paletteColor ?? '#dddddd'}
              onClick={() => setActiveColor(paletteColor)}
              style={{ cursor: 'pointer' }}
            />
          </svg>
        </div>
      )}

      <div className="capture-right">
        <div className="pill coral">
          <span className="label-white">Colour tone amount</span>
          <select
            className="amount-select"
            value={count}
            disabled={isPaletteEntry}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            <option value={6}>6</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>

        <div className="pill">
          <span className="label">HEX</span>
          <span className="value">{displayColor}</span>
          <button
            type="button"
            className="copy-btn"
            onClick={() => copyToClipboard('hex', displayColor)}
          >
            <img src={copiedFormat === 'hex' ? copyDoneIcon : copyIcon} alt="Copy" />
          </button>
        </div>

        <div className="pill">
          <span className="label">RGB</span>
          <span className="value">
            {paletteRgb ? `${paletteRgb.r}, ${paletteRgb.g}, ${paletteRgb.b}` : '--'}
          </span>
          <button
            type="button"
            className="copy-btn"
            onClick={() =>
              copyToClipboard(
                'rgb',
                paletteRgb ? `${paletteRgb.r}, ${paletteRgb.g}, ${paletteRgb.b}` : ''
              )
            }
          >
            <img src={copiedFormat === 'rgb' ? copyDoneIcon : copyIcon} alt="Copy" />
          </button>
        </div>

        <div className="pill">
          <span className="label">CMYK</span>
          <span className="value">
            {paletteCmyk
              ? `${paletteCmyk.c}, ${paletteCmyk.m}, ${paletteCmyk.y}, ${paletteCmyk.k}`
              : '--'}
          </span>
          <button
            type="button"
            className="copy-btn"
            onClick={() =>
              copyToClipboard(
                'cmyk',
                paletteCmyk
                  ? `${paletteCmyk.c}, ${paletteCmyk.m}, ${paletteCmyk.y}, ${paletteCmyk.k}`
                  : ''
              )
            }
          >
            <img src={copiedFormat === 'cmyk' ? copyDoneIcon : copyIcon} alt="Copy" />
          </button>
        </div>

        <button
          type="button"
          className="coral-btn"
          disabled={isPaletteEntry}
          onClick={async () => {
            const dataURL = await exportPng()
            if (!dataURL) return
            const result = await window.api.savePng(dataURL, 'palette')
            if (result.success) {
              console.log('Save to: ', result.path)
            }
          }}
        >
          Save colour palette
        </button>

        <div className="btn-row">
          <button
            type="button"
            className="coral-btn"
            disabled={isPaletteEntry}
            onClick={() => window.api.startCapture('palette')}
          >
            Repick
          </button>
          <button
            type="button"
            className="coral-btn"
            disabled={isPaletteEntry}
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  )
}

export default PalettePage
