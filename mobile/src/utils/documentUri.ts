// SDK 54 IntentLauncher returns Intent.toString() on some Expo Go versions.
// FileSystem needs the content URI inside it, not the serialized Intent.
export function documentUri(result: string): string {
  const uri = result.startsWith('content://') ? result :
    /^Intent \{\s/.test(result) ? result.match(/\bdat=(content:\/\/[^\s}]+)/)?.[1] : undefined;
  if (!uri || !/^content:\/\/[^/\s]+\/[^\s]+$/.test(uri)) {
    throw new Error('Không nhận được địa chỉ file hợp lệ từ Android. Hãy thử lưu báo cáo lại.');
  }
  return uri;
}
