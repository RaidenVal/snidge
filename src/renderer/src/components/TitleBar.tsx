function TitleBar(): React.JSX.Element {
  function closeWindow(): void {
    window.api.closeSettingsWindow()
  }

  return (
    <div className="title-bar">
      <span className="title-bar-text">Preference</span>
      <button className="title-bar-close" onClick={() => closeWindow()}>
        ✕
      </button>
    </div>
  )
}

export default TitleBar
