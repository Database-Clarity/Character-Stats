import type { InputHTMLAttributes } from 'react';

/** Keeps digits only: hashes are identifiers, so they are typed or picked, never stepped. */
export const hashDigits = (raw: string): string => raw.replace(/\D/g, '');

/** A uint32 hash has at most 10 digits; longer input would round-trip through `Number` as `1e+21`. */
export const HASH_MAX_DIGITS = 10;

type HashInputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange' | 'inputMode'
> & {
    value: number | string;
    onChangeValue(value: string): void;
};

export function HashInput({ value, onChangeValue, ...props }: HashInputProps) {
    return (
        <input
            {...props}
            type="text"
            inputMode="numeric"
            maxLength={HASH_MAX_DIGITS}
            autoComplete="off"
            spellCheck={false}
            className={`mono ${props.className ?? ''}`.trim()}
            value={value}
            onChange={(event) =>
                onChangeValue(hashDigits(event.target.value).slice(0, HASH_MAX_DIGITS))
            }
        />
    );
}
