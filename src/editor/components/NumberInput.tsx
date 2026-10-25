import { useEffect, useRef, type InputHTMLAttributes } from 'react';
import type { NumericConstraints } from '../../core';
import { normalizeWheelDeltaY } from './navigationShortcuts';

type NumberInputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'step' | 'value' | 'onChange'
> & {
    step: number;
    value: number | string;
    constraints?: NumericConstraints | undefined;
    onChangeValue(value: string): void;
};

function decimalParts(value: number | string): { coefficient: bigint; scale: number } {
    const [mantissa = '0', exponentText] = String(value).toLowerCase().split('e');
    const exponent = Number(exponentText ?? 0);
    const negative = mantissa.startsWith('-');
    const unsigned = negative || mantissa.startsWith('+') ? mantissa.slice(1) : mantissa;
    const [integer = '0', fraction = ''] = unsigned.split('.');
    let coefficient = BigInt(`${negative ? '-' : ''}${integer}${fraction}`);
    let scale = fraction.length - exponent;
    if (scale < 0) {
        coefficient *= 10n ** BigInt(-scale);
        scale = 0;
    }
    return { coefficient, scale };
}

export function stepNumericValue(value: number | string, step: number, direction: -1 | 1): string {
    const current = decimalParts(value === '' ? 0 : value);
    const increment = decimalParts(step);
    const scale = Math.max(current.scale, increment.scale);
    const coefficient =
        current.coefficient * 10n ** BigInt(scale - current.scale) +
        BigInt(direction) * increment.coefficient * 10n ** BigInt(scale - increment.scale);
    const negative = coefficient < 0n;
    const digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, '0');
    if (!scale) return `${negative ? '-' : ''}${digits}`;
    const integer = digits.slice(0, -scale),
        fraction = digits.slice(-scale).replace(/0+$/, '');
    return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`;
}

export function boundedStepNumericValue(
    value: number | string,
    step: number,
    direction: -1 | 1,
    constraints: NumericConstraints = {},
): string {
    const nextValue = stepNumericValue(value, step, direction),
        current = Number(value === '' ? 0 : value),
        next = Number(nextValue);
    if (!Number.isFinite(current) || !Number.isFinite(next)) return nextValue;

    if (direction > 0) {
        if (
            (constraints.max !== undefined && current >= constraints.max) ||
            (constraints.exclusiveMax !== undefined && current >= constraints.exclusiveMax) ||
            (constraints.max !== undefined &&
                current < constraints.max &&
                next > constraints.max) ||
            (constraints.exclusiveMax !== undefined &&
                current < constraints.exclusiveMax &&
                next >= constraints.exclusiveMax)
        )
            return String(value);
    } else if (
        (constraints.min !== undefined && current <= constraints.min) ||
        (constraints.exclusiveMin !== undefined && current <= constraints.exclusiveMin) ||
        (constraints.min !== undefined && current > constraints.min && next < constraints.min) ||
        (constraints.exclusiveMin !== undefined &&
            current > constraints.exclusiveMin &&
            next <= constraints.exclusiveMin)
    ) {
        return String(value);
    }
    return nextValue;
}

function scrollFocusedInput(event: WheelEvent, element: HTMLInputElement): void {
    if (document.activeElement !== element || event.deltaY === 0) return;
    event.preventDefault();
    const delta = normalizeWheelDeltaY(event.deltaY, event.deltaMode, window.innerHeight);
    let ancestor = element.parentElement;
    while (ancestor) {
        const style = window.getComputedStyle(ancestor),
            maxScroll = ancestor.scrollHeight - ancestor.clientHeight,
            canScroll =
                /(auto|scroll|overlay)/.test(style.overflowY) &&
                maxScroll > 0 &&
                (delta > 0 ? ancestor.scrollTop < maxScroll : ancestor.scrollTop > 0);
        if (canScroll) {
            ancestor.scrollTop = Math.max(0, Math.min(maxScroll, ancestor.scrollTop + delta));
            return;
        }
        ancestor = ancestor.parentElement;
    }
}

export function NumberInput({
    step,
    value,
    onChangeValue,
    constraints,
    ...props
}: NumberInputProps) {
    const label = props['aria-label'] ?? props.id ?? 'value';
    const input = useRef<HTMLInputElement>(null);
    const inputValue = String(value),
        canStep = (direction: -1 | 1) =>
            !props.disabled &&
            !props.readOnly &&
            boundedStepNumericValue(value, step, direction, constraints) !== inputValue;
    useEffect(() => {
        const element = input.current;
        if (!element) return;
        const onWheel = (event: WheelEvent) => {
            if (event.altKey && event.shiftKey) {
                event.preventDefault();
                return;
            }
            if (event.ctrlKey || event.metaKey || event.getModifierState('AltGraph')) return;
            if (!event.shiftKey) {
                scrollFocusedInput(event, element);
                return;
            }
            if (element.disabled || element.readOnly) {
                scrollFocusedInput(event, element);
                return;
            }
            if (value === '' || !Number.isFinite(Number(value)) || event.deltaY === 0) {
                scrollFocusedInput(event, element);
                return;
            }
            event.preventDefault();
            const next = boundedStepNumericValue(
                value,
                step,
                event.deltaY < 0 ? 1 : -1,
                constraints,
            );
            if (next !== inputValue) onChangeValue(next);
        };
        element.addEventListener('wheel', onWheel, { passive: false });
        return () => element.removeEventListener('wheel', onWheel);
    });
    return (
        <div className="stepped-number-input">
            <input
                ref={input}
                {...props}
                type="number"
                step="any"
                min={props.min ?? constraints?.min}
                max={props.max ?? constraints?.max}
                value={value}
                onChange={(event) => onChangeValue(event.target.value)}
                onKeyDown={(event) => {
                    props.onKeyDown?.(event);
                    if (event.defaultPrevented) return;
                    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                        event.preventDefault();
                        onChangeValue(
                            boundedStepNumericValue(
                                value,
                                step,
                                event.key === 'ArrowUp' ? 1 : -1,
                                constraints,
                            ),
                        );
                    }
                }}
            />
            <div className="stepped-number-controls" aria-label={`${label} step controls`}>
                <button
                    type="button"
                    aria-label={`Increase ${label} by ${step}`}
                    title={`Increase by ${step}`}
                    disabled={!canStep(1)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                        onChangeValue(boundedStepNumericValue(value, step, 1, constraints))
                    }
                >
                    <span aria-hidden="true">▲</span>
                </button>
                <button
                    type="button"
                    aria-label={`Decrease ${label} by ${step}`}
                    title={`Decrease by ${step}`}
                    disabled={!canStep(-1)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                        onChangeValue(boundedStepNumericValue(value, step, -1, constraints))
                    }
                >
                    <span aria-hidden="true">▼</span>
                </button>
            </div>
        </div>
    );
}
