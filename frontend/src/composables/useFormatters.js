export function formatMessage(text) {
  return text ? text.replace(/\n/g, '<br>') : ''
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
