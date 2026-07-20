'use client';

import {
  DURATION_MINUTE_STEPS,
  MAX_DURATION_HOURS,
  minutesToParts,
  partsToMinutes,
} from '@project-braids/shared-types/api';

type Props = {
  label?: string;
  valueMinutes: number;
  onChange: (totalMinutes: number) => void;
  required?: boolean;
};

export function DurationPicker({ label = 'Duration', valueMinutes, onChange, required }: Props) {
  const { hours, minutes } = minutesToParts(valueMinutes);
  const minuteOptions = DURATION_MINUTE_STEPS.includes(
    minutes as (typeof DURATION_MINUTE_STEPS)[number],
  )
    ? DURATION_MINUTE_STEPS
    : ([...DURATION_MINUTE_STEPS, minutes].sort((a, b) => a - b) as number[]);

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">
        {label}
        {required ? ' *' : ''}
      </legend>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm text-ink-muted">
          Hours
          <select
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
            value={hours}
            onChange={(e) => onChange(partsToMinutes(Number(e.target.value), minutes))}
            required={required}
          >
            {Array.from({ length: MAX_DURATION_HOURS + 1 }, (_, h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-ink-muted">
          Minutes
          <select
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
            value={minutes}
            onChange={(e) => onChange(partsToMinutes(hours, Number(e.target.value)))}
            required={required}
          >
            {minuteOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}
