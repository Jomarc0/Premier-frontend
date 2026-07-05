import { useEffect, useMemo, useRef } from 'react';

const CODE_LENGTH = 6;

export default function TotpInput({ value = '', onChange, onComplete }) {
  const refs = useRef([]);
  const digits = useMemo(() => {
    const clean = String(value).replace(/\D/g, '').slice(0, CODE_LENGTH);
    return Array.from({ length: CODE_LENGTH }, (_, index) => clean[index] || '');
  }, [value]);

  useEffect(() => {
    const code = digits.join('');
    if (code.length === CODE_LENGTH && !digits.includes('')) {
      onComplete?.(code);
    }
  }, [digits, onComplete]);

  const updateCode = (nextDigits) => {
    onChange?.(nextDigits.join('').replace(/\D/g, '').slice(0, CODE_LENGTH));
  };

  const handleChange = (index, event) => {
    const nextValue = event.target.value.replace(/\D/g, '');
    const nextDigits = [...digits];

    if (nextValue.length > 1) {
      nextValue.slice(0, CODE_LENGTH).split('').forEach((digit, offset) => {
        if (index + offset < CODE_LENGTH) nextDigits[index + offset] = digit;
      });
      updateCode(nextDigits);
      refs.current[Math.min(index + nextValue.length, CODE_LENGTH - 1)]?.focus();
      return;
    }

    nextDigits[index] = nextValue;
    updateCode(nextDigits);
    if (nextValue && index < CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    onChange?.(pasted);
    refs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  return (
    <div className="flex flex-row justify-center gap-2" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          className="h-14 w-12 rounded-lg border border-border-input text-center text-lg font-semibold text-text-heading outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
