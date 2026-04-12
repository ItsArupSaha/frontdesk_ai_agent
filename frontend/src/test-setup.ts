import '@testing-library/jest-dom'

// Recharts ResponsiveContainer uses ResizeObserver which is not in jsdom.
// Provide a minimal shim so chart components don't crash in tests.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
