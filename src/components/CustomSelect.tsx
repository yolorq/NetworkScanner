import { Check, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export function CustomSelect({
  value,
  options,
  onChange,
  className = '',
  menuClassName = '',
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((option) => option.value === value) ?? options[0];

  // The menu is portalled to body so parent overflow/scroll containers cannot
  // clip it or change its positioning context.
  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    const updatePosition = () => {
      const trigger = ref.current?.querySelector('.custom-select-trigger');
      if (!(trigger instanceof HTMLElement)) return;
      const rect = trigger.getBoundingClientRect();
      const padding = 12;
      const menuWidth = Math.min(
        Math.max(rect.width, className.includes('type-select') ? 180 : rect.width),
        window.innerWidth - padding * 2,
      );
      const expectedHeight = Math.min(options.length * 34 + 10, 230);
      const below = window.innerHeight - rect.bottom - padding;
      const above = rect.top - padding;
      const showBelow = below >= expectedHeight || below >= above;
      const maxHeight = Math.max(80, Math.min(230, showBelow ? below : above));
      const height = Math.min(expectedHeight, maxHeight);
      const top = showBelow ? rect.bottom + 5 : rect.top - height - 5;
      const left = Math.max(padding, Math.min(rect.left, window.innerWidth - menuWidth - padding));
      setMenuPosition({ left, top, width: menuWidth, maxHeight });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [className, open, options.length]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className={`custom-select ${open ? 'is-open' : ''} ${className}`}>
      <button
        type="button"
        className="custom-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{current?.label ?? 'Выберите значение'}</span>
        <ChevronDown size={14} />
      </button>
      {open && menuPosition && createPortal(
        <div
          ref={menuRef}
          id={listId}
          className={`custom-select-menu ${menuClassName}`}
          role="listbox"
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          }}
        >
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`custom-select-option ${option.value === value ? 'selected' : ''}`}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={14} />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
