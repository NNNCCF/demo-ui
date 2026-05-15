import assert from 'node:assert/strict'
import {
  getDefaultZoomStart,
  getFirstNumericMetricValue,
  maxChartPointCount,
  sampleRowsForChart,
} from './chart-density.js'

const heartRateMetric = {
  id: 'heartRate',
  label: '心率',
  unit: 'bpm',
  keys: ['heart_rate_per_min', 'heart_rate', 'heartRate'],
  color: '#f59e0b',
}

assert.equal(
  getFirstNumericMetricValue({ heart_rate: '72.5', heartRate: 80 }, heartRateMetric),
  72.5,
  'uses the first numeric alias value',
)

const denseRows = Array.from({ length: 1000 }, (_, index) => ({ ts: index, heart_rate: index }))
const sampledRows = sampleRowsForChart(denseRows)
assert.ok(
  sampledRows.length <= maxChartPointCount + 1,
  `samples dense rows to at most ${maxChartPointCount + 1} rows`,
)
assert.equal(sampledRows.at(-1), denseRows.at(-1), 'keeps the newest row after sampling')

const sparseRows = Array.from({ length: 20 }, (_, index) => ({ ts: index }))
assert.equal(sampleRowsForChart(sparseRows), sparseRows, 'keeps sparse row arrays unchanged')
assert.ok(getDefaultZoomStart(denseRows) > 0, 'dense rows default to a recent zoom window')
assert.equal(getDefaultZoomStart(sparseRows), 0, 'sparse rows show the full range')

console.log('chart-density tests passed')
