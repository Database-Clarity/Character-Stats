import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { equal } from '../state/editing';
import { NumberInput } from './NumberInput';
import {
    OUTLINE_FLOATING_MAX,
    OUTLINE_SHORT_MAX,
    initialOutlineOpen,
    outlineDefaultOpen,
} from './outlineDefault';

export function Collapse({
    storageKey,
    title,
    children,
    className = '',
    initiallyOpen = true,
}: {
    storageKey: string;
    title: ReactNode;
    children: ReactNode;
    className?: string;
    initiallyOpen?: boolean;
}) {
    const [open, setOpen] = useState(() => {
        try {
            const saved = localStorage.getItem(`clarity:collapse:${storageKey}`);
            return saved === null ? initiallyOpen : saved === 'true';
        } catch {
            return initiallyOpen;
        }
    });
    return (
        <details
            className={`collapse ${className}`}
            open={open}
            onToggle={(e) => {
                const next = e.currentTarget.open;
                setOpen(next);
                try {
                    localStorage.setItem(`clarity:collapse:${storageKey}`, String(next));
                } catch {
                    /* Private browsing may disable storage. */
                }
            }}
        >
            <summary>{title}</summary>
            <div className="collapse-body">{children}</div>
        </details>
    );
}
export function Modified({
    value,
    saved,
    onRevert,
    children,
    field,
    label,
    modified,
    revertTitle,
}: {
    value: unknown;
    saved: unknown;
    onRevert(): void;
    children: ReactNode;
    field: string;
    /** Readable field name for the revert button; falls back to the raw `field` path. */
    label?: string | undefined;
    modified?: boolean | undefined;
    revertTitle?: string | undefined;
}) {
    const changed = modified ?? !equal(value, saved);
    return (
        <div data-field={field} className={`field-frame ${changed ? 'is-modified' : ''}`}>
            {changed && (
                <button
                    className="revert-field"
                    aria-label={`Revert ${label ?? field}`}
                    title={revertTitle ?? `Saved: ${JSON.stringify(saved) ?? '(not set)'}`}
                    onClick={onRevert}
                >
                    <span className="modified-dot" /> ↶
                </button>
            )}
            {children}
        </div>
    );
}
export function StatControl({
    value,
    onChange,
    label,
}: {
    value: number;
    onChange(value: number): void;
    label: string;
}) {
    return (
        <div className="stat-control">
            <label htmlFor={`slider-${label}`}>{label}</label>
            <div className="slider-input">
                <input
                    id={`slider-${label}`}
                    type="range"
                    min={0}
                    max={200}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                />
                <NumberInput
                    aria-label={`${label} number`}
                    step={1}
                    constraints={{ min: 0, max: 200 }}
                    value={value}
                    onChangeValue={(raw) => onChange(Math.min(200, Math.max(0, Number(raw))))}
                />
            </div>
        </div>
    );
}
/** Explicit outline open/closed choices by page label, kept for the session. */
const outlineChoices = new Map<string, boolean>();

/** The nearest element (itself included) that scrolls vertically; null means the viewport. */
function scrollingAncestor(element: HTMLElement | null): HTMLElement | null {
    for (let node = element; node; node = node.parentElement) {
        const overflow = getComputedStyle(node).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') return node;
    }
    return null;
}

export function LongPage({
    items,
    children,
    label,
}: {
    items: { id: string; label: string; title?: string }[];
    children: ReactNode;
    label: string;
}) {
    const root = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(items[0]?.id);
    const [outlineOpen, setOutlineOpen] = useState(() =>
        initialOutlineOpen(window.innerWidth, items.length, outlineChoices.get(label)),
    );
    // Whether the layout scrolls `.long-content` or an ancestor (phones); bumps to re-observe.
    const [layout, setLayout] = useState(0);
    // An explicit toggle survives the short-outline breakpoint and page changes (above the
    // floating breakpoint); the floating outline always resets.
    const chose = useRef(outlineChoices.has(label)),
        entries = useRef(items.length);
    entries.current = items.length;
    useEffect(() => {
        const reset = () => setOutlineOpen(outlineDefaultOpen(window.innerWidth, entries.current));
        const floating = window.matchMedia(`(max-width: ${OUTLINE_FLOATING_MAX}px)`),
            short = window.matchMedia(`(max-width: ${OUTLINE_SHORT_MAX}px)`),
            phone = window.matchMedia('(max-width: 600px)');
        const onFloating = () => {
            chose.current = false;
            outlineChoices.delete(label);
            reset();
        };
        const onPhone = () => setLayout((n) => n + 1);
        const onShort = () => {
            if (!chose.current) reset();
        };
        floating.addEventListener('change', onFloating);
        short.addEventListener('change', onShort);
        phone.addEventListener('change', onPhone);
        return () => {
            floating.removeEventListener('change', onFloating);
            short.removeEventListener('change', onShort);
            phone.removeEventListener('change', onPhone);
        };
    }, [label]);
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                if (entry) setActive((entry.target as HTMLElement).dataset.outline);
            },
            { root: scrollingAncestor(root.current), rootMargin: '0px 0px -65% 0px', threshold: 0 },
        );
        root.current?.querySelectorAll('[data-outline]').forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [items.map((i) => i.id).join('|'), layout]);
    function toggle(open: boolean) {
        root.current?.querySelectorAll('details').forEach((d) => (d.open = open));
    }
    return (
        <div className="long-page">
            <details
                className="outline-shell"
                open={outlineOpen}
                onToggle={(event) => setOutlineOpen(event.currentTarget.open)}
            >
                <summary
                    className="outline-heading"
                    onClick={() => {
                        chose.current = true;
                        if (window.innerWidth > OUTLINE_FLOATING_MAX)
                            outlineChoices.set(label, !outlineOpen);
                    }}
                >
                    On this page
                </summary>
                <nav className="outline" aria-label={`${label} outline`}>
                    {items.map((item) => (
                        <button
                            key={item.id}
                            title={item.title ?? item.label}
                            aria-current={active === item.id ? 'location' : undefined}
                            onClick={() => {
                                const el = Array.from(
                                    root.current?.querySelectorAll<HTMLElement>('[data-outline]') ??
                                        [],
                                ).find((e) => e.dataset.outline === item.id);
                                if (!el) return;
                                el.querySelector('details')?.setAttribute('open', '');
                                el.scrollIntoView({ block: 'start', behavior: 'smooth' });
                                if (window.matchMedia('(max-width: 1100px)').matches)
                                    setOutlineOpen(false);
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                    <div className="outline-actions">
                        <button onClick={() => toggle(false)}>Collapse all</button>
                        <button onClick={() => toggle(true)}>Expand all</button>
                    </div>
                </nav>
            </details>
            <div className="scroll-pane long-content" ref={root}>
                {children}
            </div>
        </div>
    );
}

/**
 * A field's readable label, followed by the source key in dimmed text. Most fields are required,
 * so form labels tag the exceptions as optional instead of marking every required field.
 */
export function FieldName({
    spec,
    markOptional = false,
}: {
    spec: {
        key: string;
        label?: string | undefined;
        required?: boolean | undefined;
        published?: boolean | undefined;
    };
    markOptional?: boolean;
}) {
    return (
        <span className="field-name">
            <span>{spec.label ?? spec.key}</span>
            {markOptional && !spec.required && <span className="field-optional">optional</span>}
            {spec.published === false && (
                <span
                    className="field-optional field-unpublished"
                    title="Kept in sources but not exported."
                >
                    unpublished
                </span>
            )}
            {spec.label !== undefined && spec.label !== spec.key && (
                <span className="field-key" aria-hidden="true">
                    {spec.key}
                </span>
            )}
        </span>
    );
}

/** Author-facing help for a field: editor `help` when present, else the schema description. */
export const fieldHelpText = (spec: { help?: string | undefined; description: string }) =>
    spec.help ?? spec.description;

/**
 * Info button with a help popover. Click, tap, Enter or Space pins it open; a mouse hover previews
 * it; Escape, a second press or a click elsewhere closes it. Safe inside a `<summary>`: it never
 * toggles the surrounding disclosure.
 */
export function FieldHelp({ label, text }: { label: string; text: string }) {
    const [pinned, setPinned] = useState(false);
    const [hovered, setHovered] = useState(false);
    const root = useRef<HTMLSpanElement>(null);
    const id = useId();
    const open = pinned || hovered;
    useEffect(() => {
        if (!pinned) return;
        const close = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setPinned(false);
        };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [pinned]);
    return (
        <span
            className="field-help-root"
            ref={root}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(false)}
        >
            <button
                type="button"
                className="field-help"
                aria-label={`About ${label}`}
                aria-expanded={open}
                aria-controls={id}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPinned(!pinned);
                    setHovered(false);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Escape' && open) {
                        e.stopPropagation();
                        setPinned(false);
                        setHovered(false);
                    }
                    // Space and Enter would also toggle a surrounding <summary>.
                    if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
                }}
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 11v6" />
                    <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
                </svg>
            </button>
            <span id={id} role="note" className="field-help-popover" hidden={!open}>
                {text}
            </span>
        </span>
    );
}
