import { useEffect, useRef, useState, type ReactNode } from 'react';
import { equal } from '../state/editing';

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
}: {
    value: unknown;
    saved: unknown;
    onRevert(): void;
    children: ReactNode;
    field: string;
}) {
    const changed = !equal(value, saved);
    return (
        <div data-field={field} className={`field-frame ${changed ? 'is-modified' : ''}`}>
            {changed && (
                <button
                    className="revert-field"
                    aria-label={`Revert ${field}`}
                    title={`Saved: ${JSON.stringify(saved) ?? '(not set)'}`}
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
                <input
                    aria-label={`${label} number`}
                    type="number"
                    min={0}
                    max={200}
                    value={value}
                    onChange={(e) => onChange(Math.min(200, Math.max(0, Number(e.target.value))))}
                />
            </div>
        </div>
    );
}
export function LongPage({
    items,
    children,
    label,
}: {
    items: { id: string; label: string }[];
    children: ReactNode;
    label: string;
}) {
    const root = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(items[0]?.id);
    const [outlineOpen, setOutlineOpen] = useState(
        () => !window.matchMedia('(max-width: 1100px)').matches,
    );
    useEffect(() => {
        const media = window.matchMedia('(max-width: 1100px)');
        const change = () => setOutlineOpen(!media.matches);
        media.addEventListener('change', change);
        return () => media.removeEventListener('change', change);
    }, []);
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                if (entry) setActive((entry.target as HTMLElement).dataset.outline);
            },
            { root: root.current, rootMargin: '0px 0px -65% 0px', threshold: 0 },
        );
        root.current?.querySelectorAll('[data-outline]').forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [items.map((i) => i.id).join('|')]);
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
                <summary className="outline-heading">On this page</summary>
                <nav className="outline" aria-label={`${label} outline`}>
                    {items.map((item) => (
                        <button
                            key={item.id}
                            title={item.label}
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
