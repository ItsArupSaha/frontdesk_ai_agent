/**
 * Client Onboarding Wizard — 7-step guided setup.
 *
 * Admin-only page. Collects all the information needed to provision a new
 * client: business basics, working hours, service area, pricing, Google
 * Calendar OAuth, FSM integration, and a final review before launch.
 *
 * On "Launch Agent" (step 7), calls POST /api/clients/create and shows
 * a loading sequence with step-by-step progress, then a success screen
 * with the provisioned phone number.
 */
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import { createClient, type ClientCreatePayload, type ClientCreateResponse } from '../lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkingDay {
  enabled: boolean
  open: string
  close: string
}

type WorkingHours = Record<string, WorkingDay>

interface FormData {
  // Step 1
  business_name: string
  email: string
  emergency_phone: string
  services_offered: string[]
  // Step 2
  working_hours: WorkingHours
  // Step 3
  service_area_description: string
  zip_codes: string
  area_code: string
  // Step 4 (optional)
  pricing_ranges: Record<string, string>
  // Step 5 (Google Calendar)
  calendar_connected: boolean
  // Step 6 (FSM)
  fsm_type: string
  jobber_api_key: string
  housecall_pro_api_key: string
}

/** Quick-add suggestions shown as clickable pills below the input. */
const SERVICE_SUGGESTIONS = [
  'Drain Cleaning', 'Pipe Repair', 'Water Heater', 'Toilet Repair',
  'Faucet Repair', 'Gas Piping', 'Sewer Line', 'AC Repair',
  'Furnace Repair', 'Electrical Panel', 'Outlet Wiring',
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DEFAULT_HOURS: WorkingHours = {
  Mon: { enabled: true, open: '08:00', close: '18:00' },
  Tue: { enabled: true, open: '08:00', close: '18:00' },
  Wed: { enabled: true, open: '08:00', close: '18:00' },
  Thu: { enabled: true, open: '08:00', close: '18:00' },
  Fri: { enabled: true, open: '08:00', close: '18:00' },
  Sat: { enabled: true, open: '09:00', close: '14:00' },
  Sun: { enabled: false, open: '09:00', close: '17:00' },
}

const INITIAL_FORM: FormData = {
  business_name: '',
  email: '',
  emergency_phone: '',
  services_offered: [],
  working_hours: DEFAULT_HOURS,
  service_area_description: '',
  zip_codes: '',
  area_code: '',
  pricing_ranges: {},
  calendar_connected: false,
  fsm_type: 'none',
  jobber_api_key: '',
  housecall_pro_api_key: '',
}

const LAUNCH_STEPS = [
  'Creating account...',
  'Setting up voice agent...',
  'Provisioning phone number...',
  'Building knowledge base...',
  'Finalizing...',
]

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

function isValidE164(phone: string): boolean {
  return /^\+1[2-9]\d{9}$/.test(phone)
}

function isValidAreaCode(ac: string): boolean {
  return /^\d{3}$/.test(ac)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClientOnboarding() {
  const { token } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [serviceInput, setServiceInput] = useState('')
  const serviceInputRef = useRef<HTMLInputElement>(null)
  const [stepErrors, setStepErrors] = useState<string[]>([])
  const [launching, setLaunching] = useState(false)
  const [launchStep, setLaunchStep] = useState(0)
  const [result, setResult] = useState<ClientCreateResponse | null>(null)
  const [launchError, setLaunchError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Step validation
  // ---------------------------------------------------------------------------

  function validateStep(s: number): string[] {
    const errs: string[] = []
    if (s === 1) {
      if (!form.business_name.trim()) errs.push('Business name is required.')
      if (!form.email.trim()) errs.push('Email is required.')
      else if (!isValidEmail(form.email)) errs.push('Enter a valid email address.')
      if (!form.emergency_phone.trim()) errs.push('Emergency phone is required.')
      else if (!isValidE164(form.emergency_phone))
        errs.push('Phone must be US E.164 format: +1XXXXXXXXXX')
      if (form.services_offered.length === 0)
        errs.push('Add at least one service.')
    }
    if (s === 3) {
      if (!form.area_code.trim()) errs.push('Area code is required.')
      else if (!isValidAreaCode(form.area_code)) errs.push('Area code must be 3 digits.')
    }
    return errs
  }

  function handleNext() {
    const errs = validateStep(step)
    if (errs.length > 0) {
      setStepErrors(errs)
      return
    }
    setStepErrors([])
    setStep(s => s + 1)
  }

  function handleBack() {
    setStepErrors([])
    setStep(s => s - 1)
  }

  // ---------------------------------------------------------------------------
  // Field update helpers
  // ---------------------------------------------------------------------------

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function addService(raw: string) {
    const svc = raw.trim()
    if (!svc || form.services_offered.includes(svc)) return
    setForm(prev => ({ ...prev, services_offered: [...prev.services_offered, svc] }))
    setServiceInput('')
    serviceInputRef.current?.focus()
  }

  function removeService(svc: string) {
    setForm(prev => ({
      ...prev,
      services_offered: prev.services_offered.filter(s => s !== svc),
      // also clear any pricing for removed service
      pricing_ranges: Object.fromEntries(
        Object.entries(prev.pricing_ranges).filter(([k]) => k !== svc)
      ),
    }))
  }

  function setDayField(day: string, field: keyof WorkingDay, value: boolean | string) {
    setForm(prev => ({
      ...prev,
      working_hours: {
        ...prev.working_hours,
        [day]: { ...prev.working_hours[day], [field]: value },
      },
    }))
  }

  // ---------------------------------------------------------------------------
  // Launch
  // ---------------------------------------------------------------------------

  async function handleLaunch() {
    if (!token) return
    setLaunching(true)
    setLaunchError(null)
    setLaunchStep(0)

    // Simulate step-by-step progress while API call runs.
    const interval = setInterval(() => {
      setLaunchStep(prev => (prev < LAUNCH_STEPS.length - 1 ? prev + 1 : prev))
    }, 1500)

    const services = form.services_offered

    const workingHoursPayload: Record<string, { open: string; close: string } | null> =
      Object.fromEntries(
        DAYS.map(day => [
          day,
          form.working_hours[day]?.enabled
            ? { open: form.working_hours[day].open, close: form.working_hours[day].close }
            : null,
        ])
      )

    const payload: ClientCreatePayload = {
      business_name: form.business_name.trim(),
      email: form.email.trim().toLowerCase(),
      emergency_phone: form.emergency_phone.trim(),
      services_offered: services,
      working_hours: workingHoursPayload,
      service_area_description: form.service_area_description.trim(),
      zip_codes: form.zip_codes
        .split(',')
        .map(z => z.trim())
        .filter(Boolean),
      area_code: form.area_code.trim(),
      pricing_ranges: form.pricing_ranges,
      fsm_type: form.fsm_type === 'none' ? null : form.fsm_type,
      jobber_api_key: form.fsm_type === 'jobber' ? form.jobber_api_key || null : null,
      housecall_pro_api_key:
        form.fsm_type === 'housecall_pro' ? form.housecall_pro_api_key || null : null,
    }

    try {
      const res = await createClient(token, payload)
      clearInterval(interval)
      setLaunchStep(LAUNCH_STEPS.length - 1)
      setTimeout(() => setResult(res), 500)
    } catch (err: unknown) {
      clearInterval(interval)
      const msg = err instanceof Error ? err.message : String(err)
      setLaunchError(msg)
    } finally {
      setLaunching(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function ProgressBar() {
    return (
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
          <span>Step {step} of 7</span>
          <span>{Math.round((step / 7) * 100)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all"
            style={{ width: `${(step / 7) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  function Errors() {
    if (stepErrors.length === 0) return null
    return (
      <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
        {stepErrors.map((e, i) => (
          <div key={i}>{e}</div>
        ))}
      </div>
    )
  }

  function NavButtons({
    onNext,
    nextLabel = 'Continue',
    showSkip = false,
    onSkip,
  }: {
    onNext?: () => void
    nextLabel?: string
    showSkip?: boolean
    onSkip?: () => void
  }) {
    return (
      <div className="mt-8 flex items-center justify-between">
        {step > 1 ? (
          <button
            onClick={handleBack}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {showSkip && (
            <button
              onClick={onSkip ?? (() => setStep(s => s + 1))}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Skip this step
            </button>
          )}
          <button
            onClick={onNext ?? handleNext}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {nextLabel}
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Success screen
  // ---------------------------------------------------------------------------

  if (result) {
    const phone = result.phone_number
    const formatted = phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 ($1) $2-$3')
    const emailSubject = encodeURIComponent(`Your AI Agent is Live — ${form.business_name}`)
    const emailBody = encodeURIComponent(
      `Hi,\n\nYour AI front-desk agent is now live!\n\n` +
        `📞 Your dedicated phone number: ${formatted}\n\n` +
        `To activate your agent:\n` +
        `1. Log into your phone system / carrier portal.\n` +
        `2. Set up call forwarding (or change your business number) to: ${phone}\n` +
        `3. The agent will answer all calls automatically.\n\n` +
        `Your dashboard: https://app.aifrontdesk.com/dashboard\n\n` +
        `Questions? Reply to this email.\n\nBest,\nArup`
    )

    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="mb-4 text-5xl">✅</div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Agent is live!</h1>
        <p className="mb-6 text-gray-500">
          {form.business_name} is now set up and ready to receive calls.
        </p>
        <div className="mb-6 rounded-lg bg-blue-50 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-500">
            Phone number to forward calls to
          </p>
          <p className="text-2xl font-bold tracking-wide text-blue-800">{formatted}</p>
        </div>
        <div className="flex flex-col gap-3">
          <a
            href={`mailto:${form.email}?subject=${emailSubject}&body=${emailBody}`}
            className="rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Send setup instructions to client
          </a>
          <button
            onClick={() => navigate('/admin')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Back to Admin Panel
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Launching screen
  // ---------------------------------------------------------------------------

  if (launching || launchError) {
    return (
      <div className="mx-auto max-w-sm py-16 text-center">
        {launching ? (
          <>
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-sm font-medium text-gray-700">
              {LAUNCH_STEPS[launchStep]}
            </p>
            <div className="mt-4 space-y-1">
              {LAUNCH_STEPS.map((label, i) => (
                <div
                  key={i}
                  className={`text-xs ${
                    i < launchStep
                      ? 'text-green-600'
                      : i === launchStep
                      ? 'font-semibold text-blue-600'
                      : 'text-gray-300'
                  }`}
                >
                  {i < launchStep ? '✓ ' : i === launchStep ? '→ ' : '○ '}
                  {label}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 text-4xl">❌</div>
            <h2 className="mb-2 text-lg font-bold text-red-700">Launch failed</h2>
            <p className="mb-4 text-sm text-gray-600">{launchError}</p>
            <button
              onClick={() => {
                setLaunchError(null)
                setStep(7)
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </>
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-xl py-10 px-4">
      <button
        onClick={() => navigate('/admin')}
        className="mb-6 text-sm text-gray-400 hover:text-gray-600"
      >
        ← Admin Panel
      </button>
      <h1 className="mb-1 text-xl font-bold text-gray-900">Add New Client</h1>
      <p className="mb-6 text-sm text-gray-500">
        Complete all steps to provision a new agent.
      </p>
      <ProgressBar />
      <Errors />

      {/* ------------------------------------------------------------------ */}
      {/* Step 1 — Business basics */}
      {/* ------------------------------------------------------------------ */}
      {step === 1 && (
        <div>
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Step 1 — Business basics
          </h2>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Business name *</span>
              <input
                type="text"
                value={form.business_name}
                onChange={e => setField('business_name', e.target.value)}
                placeholder="e.g. Brooklyn Plumbing Co"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Client email *</span>
              <input
                type="email"
                value={form.email}
                onChange={e => setField('email', e.target.value)}
                placeholder="owner@business.com"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Emergency contact phone *
              </span>
              <p className="mb-1 text-xs text-gray-400">Format: +1XXXXXXXXXX</p>
              <input
                type="tel"
                value={form.emergency_phone}
                onChange={e => setField('emergency_phone', e.target.value)}
                placeholder="+17185551234"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <div>
              <span className="text-sm font-medium text-gray-700">Services offered *</span>
              <p className="mt-0.5 text-xs text-gray-400">
                Type each service and press Enter (or click +). Add as many as you need.
              </p>

              {/* Tag chips */}
              {form.services_offered.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.services_offered.map(svc => (
                    <span
                      key={svc}
                      className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
                    >
                      {svc}
                      <button
                        type="button"
                        onClick={() => removeService(svc)}
                        className="ml-1 text-blue-500 hover:text-red-600 leading-none"
                        aria-label={`Remove ${svc}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Input + add button */}
              <div className="mt-2 flex gap-2">
                <input
                  ref={serviceInputRef}
                  type="text"
                  value={serviceInput}
                  onChange={e => setServiceInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); addService(serviceInput) }
                  }}
                  placeholder="e.g. Drain Cleaning"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addService(serviceInput)}
                  className="rounded-md bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"
                >
                  +
                </button>
              </div>

              {/* Quick-add suggestions */}
              <div className="mt-2 flex flex-wrap gap-1">
                {SERVICE_SUGGESTIONS.filter(s => !form.services_offered.includes(s)).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addService(s)}
                    className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <NavButtons />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 2 — Working hours */}
      {/* ------------------------------------------------------------------ */}
      {step === 2 && (
        <div>
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Step 2 — Working hours
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Toggle each day on/off. Agent books appointments during these hours.
          </p>
          <div className="space-y-2">
            {DAYS.map(day => {
              const d = form.working_hours[day]
              return (
                <div key={day} className="flex items-center gap-4">
                  <label className="flex w-10 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={e => setDayField(day, 'enabled', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <span className="w-8 text-sm font-medium text-gray-700">{day}</span>
                  </label>
                  {d.enabled ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={d.open}
                        onChange={e => setDayField(day, 'open', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <span className="text-sm text-gray-400">to</span>
                      <input
                        type="time"
                        value={d.close}
                        onChange={e => setDayField(day, 'close', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Closed</span>
                  )}
                </div>
              )
            })}
          </div>
          <NavButtons />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 3 — Service area */}
      {/* ------------------------------------------------------------------ */}
      {step === 3 && (
        <div>
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Step 3 — Service area
          </h2>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Area description</span>
              <textarea
                value={form.service_area_description}
                onChange={e => setField('service_area_description', e.target.value)}
                placeholder="e.g. Serving Brooklyn, Queens, and Manhattan"
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">ZIP codes (comma separated)</span>
              <input
                type="text"
                value={form.zip_codes}
                onChange={e => setField('zip_codes', e.target.value)}
                placeholder="11201, 11211, 10001"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Area code for phone number *
              </span>
              <p className="mb-1 text-xs text-gray-400">3-digit area code (e.g. 718, 213)</p>
              <input
                type="text"
                value={form.area_code}
                onChange={e => setField('area_code', e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="718"
                maxLength={3}
                className="block w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
          </div>
          <NavButtons />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 4 — Pricing (optional) */}
      {/* ------------------------------------------------------------------ */}
      {step === 4 && (
        <div>
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Step 4 — Pricing (optional)
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            The agent uses these ranges to answer pricing questions. Leave blank to skip.
            Example: "Drain cleaning: $150–$300"
          </p>
          <div className="space-y-3">
            {form.services_offered.map(svc => (
              <label key={svc} className="block">
                <span className="text-sm font-medium text-gray-700">{svc}</span>
                <input
                  type="text"
                  value={form.pricing_ranges[svc] ?? ''}
                  onChange={e =>
                    setField('pricing_ranges', { ...form.pricing_ranges, [svc]: e.target.value })
                  }
                  placeholder="e.g. $150–$300"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
            ))}
            {form.services_offered.length === 0 && (
              <p className="text-sm text-gray-400">
                No services added — go back to Step 1 to add services.
              </p>
            )}
          </div>
          <NavButtons showSkip />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 5 — Google Calendar */}
      {/* ------------------------------------------------------------------ */}
      {step === 5 && (
        <div>
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Step 5 — Google Calendar
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Connect the client's Google Calendar so the agent can check availability and
            book appointments directly.
          </p>
          {form.calendar_connected ? (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
              <span className="text-lg">✓</span>
              <span>Google Calendar connected successfully!</span>
            </div>
          ) : (
            <div className="mb-4 rounded-md border border-dashed border-gray-300 p-6 text-center">
              <p className="mb-3 text-sm text-gray-500">
                Click below to open Google OAuth in a new tab.
                Come back here and the connection will be confirmed automatically.
              </p>
              <a
                href={`/auth/google/connect?client_id=pending`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Connect Calendar
              </a>
              <div className="mt-3">
                <button
                  onClick={() => setField('calendar_connected', true)}
                  className="text-xs text-blue-500 hover:text-blue-700"
                >
                  I've connected it — mark as done
                </button>
              </div>
            </div>
          )}
          <NavButtons showSkip nextLabel={form.calendar_connected ? 'Continue' : 'Continue'} />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 6 — FSM integration */}
      {/* ------------------------------------------------------------------ */}
      {step === 6 && (
        <div>
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Step 6 — Field Service Management (optional)
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Connect Jobber or Housecall Pro to automatically create jobs when appointments
            are booked.
          </p>
          <div className="mb-4">
            <select
              value={form.fsm_type}
              onChange={e => setField('fsm_type', e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="none">Neither — skip FSM integration</option>
              <option value="jobber">Jobber</option>
              <option value="housecall_pro">Housecall Pro</option>
            </select>
          </div>
          {form.fsm_type === 'jobber' && (
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Jobber API Key</span>
              <p className="mb-1 text-xs text-gray-400">
                Find it in Jobber → Settings → API → Generate Key
              </p>
              <input
                type="text"
                value={form.jobber_api_key}
                onChange={e => setField('jobber_api_key', e.target.value)}
                placeholder="jbk_live_..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
          )}
          {form.fsm_type === 'housecall_pro' && (
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Housecall Pro API Key</span>
              <p className="mb-1 text-xs text-gray-400">
                Find it in HCP → Settings → Integrations → API Keys
              </p>
              <input
                type="text"
                value={form.housecall_pro_api_key}
                onChange={e => setField('housecall_pro_api_key', e.target.value)}
                placeholder="hcp_..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
          )}
          <NavButtons showSkip />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 7 — Review and launch */}
      {/* ------------------------------------------------------------------ */}
      {step === 7 && (
        <div>
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Step 7 — Review and launch
          </h2>
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm space-y-2">
            <ReviewRow label="Business" value={form.business_name} />
            <ReviewRow label="Email" value={form.email} />
            <ReviewRow label="Emergency Phone" value={form.emergency_phone} />
            <ReviewRow
              label="Services"
              value={form.services_offered.join(', ') || '—'}
            />
            <ReviewRow label="Area Code" value={form.area_code || '—'} />
            <ReviewRow
              label="Service Area"
              value={form.service_area_description || '—'}
            />
            <ReviewRow
              label="Calendar"
              value={form.calendar_connected ? 'Connected' : 'Not connected'}
            />
            <ReviewRow
              label="FSM"
              value={
                form.fsm_type === 'none'
                  ? 'None'
                  : form.fsm_type === 'jobber'
                  ? 'Jobber'
                  : 'Housecall Pro'
              }
            />
          </div>
          <button
            onClick={handleLaunch}
            className="w-full rounded-md bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700"
          >
            🚀 Launch Agent
          </button>
          <button onClick={handleBack} className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600">
            ← Back to review
          </button>
        </div>
      )}
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="font-medium text-gray-600">{label}:</span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}
