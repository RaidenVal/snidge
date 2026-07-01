import snidgeCatPaletteEntry from '../assets/snidge_cat_palette_entry.png'
import copyIcon from '../../../palette/src/assets/copy.png'
import { hexToRgb, rgbToCmyk } from '../../../palette/src/colorMath'

function GradientPage(): React.JSX.Element {
  const isGradientEntry = true
  const gradientColor = '#FFFFFF'
  const gradientRgb = hexToRgb(gradientColor)
  const gradientCmyk = gradientRgb ? rgbToCmyk(gradientRgb.r, gradientRgb.g, gradientRgb.b) : null

  return (
    <section className="capture-body">
      <button
        type="button"
        className="capture-cat-button"
        aria-label="Start gradient colour capture"
        onClick={() => console.log('gradient colour A capture clicked')}
      >
        <img src={snidgeCatPaletteEntry} alt="" />
      </button>

      <div className="capture-right">
        <div className="pill coral">
          <span className="label-white">Colour tone amount</span>
          <select className="amount-select" value={9} disabled={isGradientEntry}>
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
