interface Props {
  label: string
  value: string | number
  subtext?: string
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'gray'
}

const colorMap: Record<NonNullable<Props['color']>, string> = {
  blue:   'bg-blue-50   border-blue-200   text-blue-700',
  green:  'bg-green-50  border-green-200  text-green-700',
  red:    'bg-red-50    border-red-200    text-red-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  gray:   'bg-gray-50   border-gray-200   text-gray-700',
}

const valueColorMap: Record<NonNullable<Props['color']>, string> = {
  blue:   'text-blue-900',
  green:  'text-green-900',
  red:    'text-red-900',
  yellow: 'text-yellow-900',
  gray:   'text-gray-900',
}

export default function MetricCard({ label, value, subtext, color = 'blue' }: Props) {
  return (
    <div
      data-testid="metric-card"
      className={`rounded-lg border p-5 ${colorMap[color]}`}
    >
      <p className="text-sm font-medium uppercase tracking-wide opacity-75">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${valueColorMap[color]}`}>{value}</p>
      {subtext && <p className="mt-1 text-xs opacity-60">{subtext}</p>}
    </div>
  )
}
