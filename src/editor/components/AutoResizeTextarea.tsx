import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

export interface AutoResizeTarget {
    style: { height: string };
    scrollHeight: number;
    offsetHeight: number;
    clientHeight: number;
}

export function resizeTextarea(textarea: AutoResizeTarget): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight + textarea.offsetHeight - textarea.clientHeight}px`;
}

export function AutoResizeTextarea({
    value,
    style,
    ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    const ref = useRef<HTMLTextAreaElement>(null);
    useLayoutEffect(() => {
        if (ref.current) resizeTextarea(ref.current);
    }, [value]);
    useLayoutEffect(() => {
        const textarea = ref.current;
        if (!textarea) return;
        let width = textarea.getBoundingClientRect().width;
        const observer = new ResizeObserver(([entry]) => {
            if (!entry || Math.abs(entry.contentRect.width - width) < 0.5) return;
            width = entry.contentRect.width;
            resizeTextarea(textarea);
        });
        observer.observe(textarea);
        return () => observer.disconnect();
    }, []);
    return (
        <textarea
            {...props}
            ref={ref}
            value={value}
            style={{ ...style, overflowY: 'hidden', resize: 'none' }}
        />
    );
}
