/**
 * Supabase の URL を「https://xxxx.supabase.co」だけにする。
 * ダッシュボードからコピーすると「…/rest/v1/」などが付いていることがあり、そのままだと
 * 「…/rest/v1/auth/v1/signup」のような存在しない宛先になってしまうため。
 */
export function normalizeServerUrl(input: string) {
  const s = input.trim()
  try {
    return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).origin
  } catch {
    return s
  }
}
