function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isPreviewableImage(url = '') {
  return /(\.png|\.jpe?g|\.gif|\.webp|\.svg)(\?.*)?$/i.test(url) || /\/(?:uploads|outputs)\/.*\.(png|jpe?g|gif|webp|svg)$/i.test(url)
}

function isPreviewableVideo(url = '') {
  return /(\.mp4|\.webm|\.ogg|\.mov)(\?.*)?$/i.test(url) || /\/(?:uploads|outputs)\/.*\.(mp4|webm|ogg|mov)$/i.test(url)
}

function isTrustedAssetUrl(url = '') {
  const value = String(url || '').trim()
  if (!value) return false
  if (/^\/(?:uploads|outputs)\//i.test(value)) return true

  try {
    const parsed = new URL(value, window.location.origin)
    return parsed.origin === window.location.origin && /^\/(?:uploads|outputs)\//i.test(parsed.pathname)
  } catch {
    return false
  }
}

function buildAssetMarkup(url, label) {
  const safeUrl = escapeHtml(url)
  const safeLabel = escapeHtml(label)
  const downloadHref = safeUrl.includes('?') ? `${safeUrl}&download=1` : `${safeUrl}?download=1`
  if (isTrustedAssetUrl(url) && isPreviewableImage(url)) {
    return `<span class="message-asset"><img class="message-preview-image" src="${safeUrl}" alt="${safeLabel}"><span class="message-asset-actions"><a class="message-action-btn" href="${safeUrl}" target="_blank" rel="noreferrer">Preview</a><a class="message-action-btn" href="${downloadHref}" target="_blank" rel="noreferrer">${safeLabel}</a></span></span>`
  }
  if (isTrustedAssetUrl(url) && isPreviewableVideo(url)) {
    return `<span class="message-asset"><video class="message-preview-video" src="${safeUrl}" controls preload="metadata"></video><span class="message-asset-actions"><a class="message-action-btn" href="${safeUrl}" target="_blank" rel="noreferrer">Preview</a><a class="message-action-btn" href="${downloadHref}" target="_blank" rel="noreferrer">${safeLabel}</a></span></span>`
  }
  if (isTrustedAssetUrl(url)) {
    return `<span class="message-asset"><a class="message-download-link" href="${safeUrl}" target="_blank" rel="noreferrer">${safeLabel}</a><span class="message-asset-actions"><a class="message-action-btn" href="${safeUrl}" target="_blank" rel="noreferrer">Preview</a><a class="message-action-btn" href="${downloadHref}" target="_blank" rel="noreferrer">Download</a></span></span>`
  }
  return `<a class="message-download-link" href="${safeUrl}" target="_blank" rel="noreferrer">${safeLabel}</a>`
}

export function formatMessage(text) {
  if (!text) return ''
  const escaped = escapeHtml(text)
  const withLinks = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => buildAssetMarkup(url, label))
  return withLinks.replace(/\n/g, '<br>')
}

export function prettyDate(value) {
  if (value === null || value === undefined || value === '') return 'No timestamp'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid timestamp'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

export function dualCurrency(value, usdToInrRate = 83.5) {
  const usd = Number(value || 0)
  const inr = usd * usdToInrRate
  return `$${usd.toFixed(2)} / Rs.${inr.toFixed(0)}`
}

export function isLikelyContinuationPrompt(prompt) {
  const value = String(prompt || '').trim().toLowerCase()
  if (!value) return false
  return [
    'yes',
    'no',
    'continue',
    'proceed',
    'approved',
    'boss approved',
    'approve',
    'reject',
    'cancel',
    'use saved settings',
    'use configured meta access token',
    'use configured meta page id'
  ].includes(value)
}
