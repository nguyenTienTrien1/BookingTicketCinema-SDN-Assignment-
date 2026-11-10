import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// Expo Router handles navigation; Safari's modal must also be dismissed on iOS.
export async function openExternal(url: string) {
  const subscription = Linking.addEventListener('url', event => {
    if (Platform.OS === 'ios' && /\/(auth-return|payment-return)(?:\?|$)/.test(event.url)) {
      void WebBrowser.dismissBrowser().catch(() => {});
    }
  });
  try { return await WebBrowser.openBrowserAsync(url); }
  finally { subscription.remove(); }
}
