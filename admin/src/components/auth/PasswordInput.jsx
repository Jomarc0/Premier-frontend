import { useState } from 'react';
import { FiEye, FiEyeOff, FiLock } from 'react-icons/fi';

const PasswordInput = ({
    id,
    value,
    onChange,
    placeholder = 'Enter your password',
    autoComplete = 'current-password',
    required = false,
    hasError = false
}) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div
            className={`flex items-center gap-[0.7rem] min-h-[3.1rem] mb-[1.15rem] px-[0.95rem] border-2 rounded-lg bg-white text-brand-primary transition-all focus-within:border-brand-primary focus-within:shadow-[0_0_0_4px_rgba(92,32,40,0.14)] ${
                hasError ? 'border-red-500' : 'border-border-input'
            }`}
        >
            <FiLock />
            <input
                id={id}
                type={showPassword ? 'text' : 'password'}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                autoComplete={autoComplete}
                required={required}
                className="w-full min-w-0 border-0 outline-0 bg-transparent text-text-heading text-[0.95rem] placeholder:text-text-placeholder"
            />
            <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-brand-primary transition-colors hover:bg-brand-primary/10"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
                {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
        </div>
    );
};

export default PasswordInput;
