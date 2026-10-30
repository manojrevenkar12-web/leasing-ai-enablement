'use client';

import styles from './ui.module.css';

/** A choice between a few values, as a radio group (arrow keys move between options). */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <fieldset className={styles.segmented}>
      <legend className={styles.fieldLabel}>{label}</legend>
      <div className={styles.segmentedTrack}>
        {options.map((o) => (
          <label key={String(o.value)} className={styles.segment} data-active={o.value === value || undefined}>
            <input type="radio" name={name} value={String(o.value)} checked={o.value === value} onChange={() => onChange(o.value)} className="visually-hidden" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
