import snidgeCatPaletteEntry from '../assets/snidge_cat_palette_entry.png'
import copyIcon from '../../../palette/src/assets/copy.png'
import { hexToRgb, rgbToCmyk } from '../../../palette/src/colorMath'
import { useEffect, useState } from 'react'
import { generateGradient, type GradientToneAmount } from '../gradientMath'
import copyDoneIcon from '../../../palette/src/assets/copydone.png'

function GradientPage(): React.JSX.Element {
  const [gradientColourA, setGradientColourA] = useState<string | null>(null)
  const [gradientColourB, setGradientColourB] = useState('#FFFFFF')
  const [gradientCaptureTarget, setGradientCaptureTarget] = useState<'a' | 'b'>('a')
  const [gradientToneAmount, setGradientToneAmount] = useState<GradientToneAmount>(9)
  const [inspectedGradientColor, setInspectedGradientColor] = useState<string | null>(null)
  const [copiedGradientFormat, setCopiedGradientFormat] = useState<string | null>(null)

  const isGradientEntry = gradientColourA === null
  const gradientColor = inspectedGradientColor ?? gradientColourA ?? '#FFFFFF'
  const gradientColours = gradientColourA
    ? generateGradient(gradientColourA, gradientColourB, gradientToneAmount)
    : []

  const gradientRgb = hexToRgb(gradientColor)
  const gradientCmyk = gradientRgb ? rgbToCmyk(gradientRgb.r, gradientRgb.g, gradientRgb.b) : null

  const gradientHexText = gradientColor
  const gradientRgbText = gradientRgb ? `${gradientRgb.r}, ${gradientRgb.g}, ${gradientRgb.b}` : ''
  const gradientCmykText = gradientCmyk
    ? `${gradientCmyk.c}, ${gradientCmyk.m}, ${gradientCmyk.y}, ${gradientCmyk.k}`
    : ''

  function startGradientCapture(target: 'a' | 'b'): void {
    setGradientCaptureTarget(target)
    window.api.startCapture('gradient')
  }

  function copyGradientValue(format: string, text: string): void {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedGradientFormat(format)
    setTimeout(() => setCopiedGradientFormat(null), 2000)
  }

  useEffect(() => {
    return window.api.onGradientColorPicked((hex) => {
      setInspectedGradientColor(null)

      if (gradientCaptureTarget === 'a') {
        setGradientColourA(hex)
        return
      }
      setGradientColourB(hex)
    })
  }, [gradientCaptureTarget])

  return (
    <section className="capture-body">
      {isGradientEntry ? (
        <button
          type="button"
          className="capture-cat-button"
          aria-label="Start gradient colour capture"
          onClick={() => startGradientCapture('a')}
        >
          <img src={snidgeCatPaletteEntry} alt="" />
        </button>
      ) : (
        <div className="gradient-left">
          <div className="gradient-colour-tabs">
            <button
              type="button"
              className="gradient-colour-tab"
              onClick={() => startGradientCapture('a')}
            >
              <span>Colour A</span>
              <span
                className="gradient-colour-swatch"
                style={{ backgroundColor: gradientColourA }}
              />
            </button>

            <button
              type="button"
              className="gradient-colour-tab"
              onClick={() => startGradientCapture('b')}
            >
              <span>Colour B</span>
              <span
                className="gradient-colour-swatch"
                style={{ backgroundColor: gradientColourB }}
              />
            </button>
          </div>

          <div className={`gradient-grid gradient-grid-${gradientToneAmount}`}>
            {gradientColours.map((colour, index) => (
              <button
                key={`${colour}-${index}`}
                type="button"
                className="gradient-swatch"
                style={{ backgroundColor: colour }}
                aria-label={colour}
                onClick={() => setInspectedGradientColor(colour)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="capture-right">
        <div className="pill coral">
          <span className="label-white">Colour tone amount</span>
          <select
            className="amount-select"
            value={gradientToneAmount}
            disabled={isGradientEntry}
            onChange={(e) => {
              setInspectedGradientColor(null)
              setGradientToneAmount(Number(e.target.value) as GradientToneAmount)
            }}
          >
            <option value={4}>4</option>
            <option value={9}>9</option>
            <option value={16}>16</option>
          </select>
        </div>

        <div className="pill">
          <span className="label">HEX</span>
          <span className="value">{gradientHexText}</span>
          <button
            type="button"
            className="copy-btn"
            onClick={() => copyGradientValue('hex', gradientHexText)}
          >
            <img src={copiedGradientFormat === 'hex' ? copyDoneIcon : copyIcon} alt="Copy" />
          </button>
        </div>

        <div className="pill">
          <span className="label">RGB</span>
          <span className="value">{gradientRgbText}</span>
          <button
            type="button"
            className="copy-btn"
            onClick={() => copyGradientValue('rgb', gradientRgbText)}
          >
            <img src={copiedGradientFormat === 'rgb' ? copyDoneIcon : copyIcon} alt="Copy" />
          </button>
        </div>

        <div className="pill">
          <span className="label">CMYK</span>
          <span className="value">{gradientCmykText || '--'}</span>
          <button
            type="button"
            className="copy-btn"
            onClick={() => copyGradientValue('cmyk', gradientCmykText)}
          >
            <img src={copiedGradientFormat === 'cmyk' ? copyDoneIcon : copyIcon} alt="Copy" />
          </button>
        </div>

        <button type="button" className="coral-btn" disabled>
          Save colour palette
        </button>

        <div className="btn-row">
          <button type="button" className="coral-btn" disabled>
            Repick
          </button>
          <button type="button" className="coral-btn" disabled>
            Cancel
          </button>
        </div>
      </div>
    </section>
  )
}

export default GradientPage
