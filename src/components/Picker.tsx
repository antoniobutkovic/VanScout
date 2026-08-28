import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type PickerOption = {
  value: string;
  label: ReactNode;
};

type PickerProps = {
  label?: ReactNode;
  options: PickerOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  ariaLabel?: string;
  renderValue?: (option: PickerOption | undefined) => ReactNode;
  renderOption?: (option: PickerOption) => ReactNode;
};

export function Picker({
  label,
  options,
  value,
  defaultValue,
  onChange,
  className = "",
  ariaLabel,
  renderValue,
  renderOption,
}: PickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerId = useId();
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const selectedValue = value ?? internalValue;
  const selected = options.find((option) => option.value === selectedValue) ?? options[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const choose = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(false);
  };

  return (
    <div className={`picker-field ${className}`.trim()} ref={pickerRef}>
      {label && <div className="picker-label">{label}</div>}
      <button
        type="button"
        className="picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={pickerId}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{renderValue ? renderValue(selected) : selected?.label}</span>
        <span className="picker-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="picker-menu" id={pickerId} role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === selectedValue}
              className={`picker-option ${option.value === selectedValue ? "selected" : ""}`.trim()}
              key={option.value}
              onClick={() => choose(option.value)}
            >
              {renderOption ? renderOption(option) : option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
