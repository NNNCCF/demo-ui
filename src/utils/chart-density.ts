export type ChartMetricDefinition = {
  id: string
  label: string
  unit: string
  keys: string[]
  color: string
}

export const maxChartPointCount = 240
export const minDefaultZoomPointCount = 40
export const defaultZoomRatio = 0.3

export function getFirstNumericMetricValue(row: Record<string, unknown>, metric: ChartMetricDefinition) {
  for (const key of metric.keys) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string') {
      const num = Number(value)
      if (Number.isFinite(num)) {
        return num
      }
    }
  }
  return null
}

export function sampleRowsForChart(rows: Record<string, unknown>[]) {
  if (rows.length <= maxChartPointCount) {
    return rows
  }
  const step = Math.ceil(rows.length / maxChartPointCount)
  const sampled = rows.filter((_, index) => index % step === 0)
  const last = rows[rows.length - 1]
  if (last && sampled[sampled.length - 1] !== last) {
    sampled.push(last)
  }
  return sampled
}

export function getDefaultZoomStart(rows: Record<string, unknown>[]) {
  if (rows.length <= minDefaultZoomPointCount) {
    return 0
  }
  const visibleCount = Math.max(minDefaultZoomPointCount, Math.floor(rows.length * defaultZoomRatio))
  const hiddenCount = Math.max(rows.length - visibleCount, 0)
  return Math.round((hiddenCount / rows.length) * 100)
}
