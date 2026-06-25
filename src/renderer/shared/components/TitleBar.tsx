interface Props {
  title: string
  onClose: () => void
}

function TitleBar({ title, onClose }: Props): React.JSX.Element {
  return (
    <div className="title-bar">
      <span className="title-bar-text">{title}</span>
      <button className="title-bar-close" onClick={onClose}>
        <svg width="50" height="50" viewBox="0 0 24 24">
          <line
            x1="6"
            y1="6"
            x2="18"
            y2="18"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="18"
            y1="6"
            x2="6"
            y2="18"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}

export default TitleBar
