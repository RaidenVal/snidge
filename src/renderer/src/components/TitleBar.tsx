interface Props {
  title: string
  onClose: () => void
}

function TitleBar({ title, onClose }: Props): React.JSX.Element {
  return (
    <div className="title-bar">
      <span className="title-bar-text">{title}</span>
      <button className="title-bar-close" onClick={onClose}>
        ✕
      </button>
    </div>
  )
}

export default TitleBar
