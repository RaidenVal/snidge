import { useState } from 'react'
import snidgeCatPaletteEntry from '../assets/snidge_cat_palette_entry.png'
import copyIcon from '../../../palette/src/assets/copy.png'
import copyDoneIcon from '../../../palette/src/assets/copydone.png'
import { hexToRgb, rgbToCmyk } from '../../../palette/src/colorMath'

function PalettePage(): React.JSX.Element {
  const [count, setCount] = useState(10)
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)

  function copyToClipboard(format: string, text: string): void {
    navigator.clipboard.writeText(text)
    setCopiedFormat(format)
    setTimeout(() => setCopiedFormat(null), 2000)
  }

  const isPaletteEntry = true
  const paletteColor = '#FFFFFF'
  const paletteRgb = hexToRgb(paletteColor)
  const paletteCmyk = paletteRgb ? rgbToCmyk(paletteRgb.r, paletteRgb.g, paletteRgb.b) : null

  return (
    <section className="capture-body">
      <button
        type="button"
        className="capture-cat-button"
        aria-label="Start colour capture"
        onClick={() => window.api.startCapture('palette')}
      >
        <img src={snidgeCatPaletteEntry} alt="" />
      </button>

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
          <span className="value">{paletteColor}</span>
          <button
            type="button"
            className="copy-btn"
            onClick={() => copyToClipboard('hex', paletteColor)}
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

        <button type="button" className="coral-btn" disabled={isPaletteEntry}>
          Save colour palette
        </button>

        <div className="btn-row">
          <button type="button" className="coral-btn" disabled={isPaletteEntry}>
            Repick
          </button>
          <button type="button" className="coral-btn" disabled={isPaletteEntry}>
            Cancel
          </button>
        </div>
      </div>
    </section>
  )
}

export default PalettePage
