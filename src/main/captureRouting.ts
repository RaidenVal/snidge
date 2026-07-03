export type CapturePurpose = 'palette' | 'gradient'
export type PickedColorChannel = 'palette-color-picked' | 'gradient-color-picked'

export function channelForCapturePurpose(purpose: CapturePurpose): PickedColorChannel {
  switch (purpose) {
    case 'palette':
      return 'palette-color-picked'
    case 'gradient':
      return 'gradient-color-picked'
  }
}
