import { useEffect, useState } from "react"
import { Keyboard, Platform } from "react-native"

// KeyboardAvoidingView is unreliable on Android under Expo SDK 54 / RN 0.81
// with edge-to-edge (Android 15+): the system ignores android:windowSoftInputMode
// adjustResize, so KeyboardAvoidingView's JS-measured keyboard height comes out
// wrong and the composer is left hidden behind the keyboard (see #53/#70/#147).
// Track the height directly from the Keyboard events and pad the composer
// instead — deterministic and independent of native window resize.
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"

    const onShow = (e: { endCoordinates: { height: number } }) => setHeight(e.endCoordinates.height)
    const onHide = () => setHeight(0)

    const showSub = Keyboard.addListener(showEvent, onShow)
    const hideSub = Keyboard.addListener(hideEvent, onHide)
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  return height
}
