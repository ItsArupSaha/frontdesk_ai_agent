type Status =
  | 'emergency'
  | 'booked'
  | 'completed'
  | 'confirmed'
  | 'cancelled'
  | 'in_progress'
  | 'failed'
  | string

interface Props {
  status: Status
  label?: string
}

function resolveStyle(status: Status): string {
  switch (status) {
    case 'emergency':
      return 'bg-red-100 text-red-800'
    case 'booked':
    case 'confirmed':
      return 'bg-green-100 text-green-800'
    case 'completed':
      return 'bg-blue-100 text-blue-800'
    case 'cancelled':
      return 'bg-gray-100 text-gray-600'
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800'
    case 'failed':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export default function StatusBadge({ status, label }: Props) {
  return (
    <span
      data-testid="status-badge"
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${resolveStyle(status)}`}
    >
      {label ?? status.replace(/_/g, ' ')}
    </span>
  )
}
