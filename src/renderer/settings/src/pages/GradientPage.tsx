import snidgeCatPaletteEntry from '../assets/snidge_cat_palette_entry.png'
import copyIcon from '../../../palette/src/assets/copy.png'
import { hexToRgb, rgbToCmyk } from '../../../palette/src/colorMath'
import { useEffect, useState } from 'react'
import { generateGradient, type GradientToneAmount } from '../gradientMath'

function GradientPage(): React.JSX.Element {
  const [gradientColourA, setGradientColourA] = useState<string | null>(null)
  const [gradientColourB, setGradientColourB] = useState('#FFFFFF')
  const [gradientCaptureTarget, setGradientCaptureTarget] = useState<'a' | 'b'>('a')
  const [gradientToneAmount, setGradientToneAmount] = useState<GradientToneAmount>(9)

  const isGradientEntry = gradientColourA === null
  const gradientColor = gradientColourA ?? '#FFFFFF'
  const gradientColours = gradientColourA
    ? generateGradient(gradientColourA, gradientColourB, gradientToneAmount)
    : []

  const gradientRgb = hexToRgb(gradientColor)
  const gradientCmyk = gradientRgb ? rgbToCmyk(gradientRgb.r, gradientRgb.g, gradientRgb.b) : null

  function startGradientCapture(target: 'a' | 'b'): void {
    setGradientCaptureTarget(target)
    window.api.startCapture('gradient')
  }

  useEffect(() => {
    return window.api.onGradientColorPicked((hex) => {
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
            onChange={(e) => setGradientToneAmount(Number(e.target.value) as GradientToneAmount)}
          >
            <option value={4}>4</option>
            <option value={9}>9</option>
            <option value={16}>16</option>
          </select>
        </div>

        <div className="pill">
          <span className="label">HEX</span>
          <span className="value">{gradientColor}</span>
          <button type="button" className="copy-btn">
            <img src={copyIcon} alt="Copy" />
          </button>
        </div>

        <div className="pill">
          <span className="label">RGB</span>
          <span className="value">
            {gradientRgb ? `${gradientRgb.r}, ${gradientRgb.g}, ${gradientRgb.b}` : '--'}
          </span>
          <button type="button" className="copy-btn">
            <img src={copyIcon} alt="Copy" />
          </button>
        </div>

        <div className="pill">
          <span className="label">CMYK</span>
          <span className="value">
            {gradientCmyk
              ? `${gradientCmyk.c}, ${gradientCmyk.m}, ${gradientCmyk.y}, ${gradientCmyk.k}`
              : '--'}
          </span>
          <button type="button" className="copy-btn">
            <img src={copyIcon} alt="Copy" />
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
