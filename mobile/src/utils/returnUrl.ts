export function expoGoReturnUrl(path: string, hostUri?: string, linkingUri?: string) {
  if (!/^\/(payment-return|auth-return)$/.test(path)) throw new Error('Unsupported app return route');
  // A configured custom scheme belongs to an installed build, not the Expo Go container.
  let base: URL | undefined;
  if (linkingUri && /^exps?:\/\//.test(linkingUri)) {
    const candidate = new URL(linkingUri);
    if (candidate.host) base = candidate;
  }
  if (!base && hostUri) {
    base = new URL(/^[a-z]+:\/\//i.test(hostUri) ? hostUri : `exp://${hostUri}`);
    if (['http:', 'https:'].includes(base.protocol)) {
      const scheme = base.protocol === 'https:' ? 'exps:' : 'exp:';
      base = new URL(`${scheme}//${base.host}`);
    }
  }
  if (!base?.host || !['exp:', 'exps:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('Không xác định được địa chỉ Expo Go. Vui lòng mở lại dự án từ Expo.');
  }
  return `${base.protocol}//${base.host}/--${path}`;
}
