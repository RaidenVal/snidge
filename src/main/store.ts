// Store is going to save the config into the disk
// So everytime when app starts it can recall memory
// To know the default value of hotkey
import Store from 'electron-store'

// Define the type of SnidgeConfig
type SnidgeConfig = {
  hotkey: string
}

// Create a new store instance of type SnidgeConfig
const store = new Store<SnidgeConfig>({
  defaults: {
    hotkey: 'CommandOrControl+Alt+S'
  }
})

export default store
