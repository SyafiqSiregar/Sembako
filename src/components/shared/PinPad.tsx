import React from 'react';
import { Delete, X } from 'lucide-react';

interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
  onComplete?: (pin: string) => void;
  error?: string | null;
}

export const PinPad: React.FC<PinPadProps> = ({
  value,
  onChange,
  maxLength = 6,
  disabled = false,
  onComplete,
  error,
}) => {
  const handleDigit = (digit: string) => {
    if (disabled || value.length >= maxLength) return;
    const nextVal = value + digit;
    onChange(nextVal);
    if (nextVal.length === maxLength && onComplete) {
      onComplete(nextVal);
    }
  };

  const handleBackspace = () => {
    if (disabled || value.length === 0) return;
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    if (disabled) return;
    onChange('');
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xs mx-auto">
      {/* Masked Dots Indicator */}
      <div className="flex items-center gap-3 py-2" aria-label={`PIN ${value.length} dari ${maxLength} digit`}>
        {Array.from({ length: maxLength }).map((_, idx) => (
          <div
            key={idx}
            className={`size-4 rounded-full transition-all duration-200 ${
              idx < value.length
                ? 'bg-primary scale-110 shadow-sm'
                : 'border-2 border-border bg-card'
            }`}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-xs text-destructive-text font-medium text-center bg-destructive/15 px-3 py-1.5 rounded-pill border border-destructive/20 w-full animate-shake">
          {error}
        </div>
      )}

      {/* Grid Tombol Numpad 56px (Tablet POS standard) */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => handleDigit(digit)}
            className="h-14 rounded-card bg-card border border-input text-xl font-bold text-foreground hover:bg-muted active:bg-accent transition-colors shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            {digit}
          </button>
        ))}

        {/* Clear Button */}
        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={handleClear}
          className="h-14 rounded-card bg-card border border-input text-xs font-semibold text-muted-foreground hover:bg-muted active:bg-accent transition-colors shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
          title="Hapus Semua"
        >
          <X className="size-5" />
        </button>

        {/* Digit 0 */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleDigit('0')}
          className="h-14 rounded-card bg-card border border-input text-xl font-bold text-foreground hover:bg-muted active:bg-accent transition-colors shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          0
        </button>

        {/* Backspace Button */}
        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={handleBackspace}
          className="h-14 rounded-card bg-card border border-input text-xs font-semibold text-muted-foreground hover:bg-muted active:bg-accent transition-colors shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
          title="Hapus Satu"
        >
          <Delete className="size-5" />
        </button>
      </div>
    </div>
  );
};
