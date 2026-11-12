import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { expoGoReturnUrl } from '../utils/returnUrl';

export function appReturnUrl(path: '/payment-return' | '/auth-return') {
  if (Platform.OS !== 'web' && isRunningInExpoGo()) {
    return expoGoReturnUrl(path, Constants.expoConfig?.hostUri, Constants.linkingUri);
  }
  return Linking.createURL(path);
}
