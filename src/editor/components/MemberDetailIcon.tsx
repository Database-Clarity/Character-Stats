import {
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import type { EntitySpec, FieldSpec } from '../../core';
import { ManifestIcon, useManifest, type ManifestEntry } from '../manifest';
import { isPrismaticAbility } from '../manifest/prismatic';

export interface MemberDetailValue {
    label: string;
    value: unknown;
    field?: FieldSpec;
}

export function memberClickAction(event: {
    detail: number;
    ctrlKey: boolean;
    shiftKey: boolean;
}): 'navigate' | 'defer' | 'tooltip' {
    if (event.shiftKey) return 'navigate';
    return event.detail > 1 ? 'defer' : 'tooltip';
}

const HOVER_OPEN_DELAY_MS = 250;
const HOVER_CLOSE_DELAY_MS = 120;
const useTooltipPositionEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface ActiveMemberTooltip {
    id: string;
    mode: 'hover' | 'focus' | 'pinned';
}

let activeMemberTooltip: ActiveMemberTooltip | null = null;
const activeMemberTooltipListeners = new Set<() => void>();

function subscribeToActiveMemberTooltip(listener: () => void): () => void {
    activeMemberTooltipListeners.add(listener);
    return () => activeMemberTooltipListeners.delete(listener);
}

function getActiveMemberTooltip(): ActiveMemberTooltip | null {
    return activeMemberTooltip;
}

function setActiveMemberTooltip(next: ActiveMemberTooltip | null): void {
    if (activeMemberTooltip?.id === next?.id && activeMemberTooltip?.mode === next?.mode) {
        return;
    }
    activeMemberTooltip = next;
    activeMemberTooltipListeners.forEach((listener) => listener());
}

function sourceNameOf(member: Record<string, unknown>): string | undefined {
    return typeof member.Name === 'string' && member.Name.trim() ? member.Name.trim() : undefined;
}

export function memberDetailValues(
    spec: EntitySpec,
    member: Record<string, unknown>,
    entry?: ManifestEntry,
): MemberDetailValue[] {
    const sourceName = sourceNameOf(member);
    const isPrismatic = isPrismaticAbility(entry) || /\bprismatic\b/i.test(sourceName ?? '');

    return [
        { label: 'Source name', value: sourceName ?? 'Not set' },
        { label: 'Manifest name', value: entry?.name ?? 'Unavailable' },
        { label: 'Hash', value: member.Hash ?? 'Unknown' },
        { label: 'Entry type', value: spec.name },
        {
            label: 'Variant',
            value: isPrismatic
                ? 'Prismatic'
                : entry
                  ? 'Standard'
                  : 'Not available without the manifest',
        },
        { label: 'Manifest type', value: entry?.typeName ?? 'Unavailable' },
        { label: 'Manifest category', value: entry?.plugCategory ?? 'Unavailable' },
        { label: 'Manifest description', value: entry?.description ?? 'Unavailable' },
        ...spec.fields
            .filter((field) => field.key !== 'Hash' && field.key !== 'Name')
            .map((field) => ({ label: field.label ?? field.key, value: member[field.key], field })),
    ];
}

export function formatMemberDetailValue(value: unknown, field?: FieldSpec): string {
    if (value === undefined) return field?.required === false ? 'Not set (optional)' : 'Missing';
    if (value === null) return 'Null';
    if (value === '') return 'Empty string';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return JSON.stringify(value, null, 2) ?? String(value);
}

export function MemberDetailIcon({
    spec,
    member,
    name,
    presentation = 'icon',
    onOpen,
}: {
    spec: EntitySpec;
    member: Record<string, unknown>;
    name?: string | undefined;
    presentation?: 'icon' | 'card';
    onOpen?(member: Record<string, unknown>): void;
}): React.JSX.Element {
    const { lookup } = useManifest();
    const hashValue = member.Hash;
    const hash =
        typeof hashValue === 'number' && Number.isInteger(hashValue) ? hashValue : Number.NaN;
    const entry = Number.isFinite(hash) ? lookup(hash, 'item') : undefined;
    const sourceName = sourceNameOf(member);
    const displayName =
        name?.trim() || entry?.name || sourceName || `Unknown ability ${String(hashValue ?? '')}`;
    const prismatic = isPrismaticAbility(entry) || /\bprismatic\b/i.test(sourceName ?? '');
    const hashLabel = String(hashValue ?? 'unknown hash');
    const details = memberDetailValues(spec, member, entry);
    const trigger = useRef<HTMLButtonElement>(null);
    const tooltip = useRef<HTMLDivElement>(null);
    const openTimer = useRef<number | undefined>(undefined);
    const leaveTimer = useRef<number | undefined>(undefined);
    const [dismissed, setDismissed] = useState(false);
    const [position, setPosition] = useState<CSSProperties>({ top: 0, left: 0 });
    const tooltipId = `member-details-${useId().replaceAll(':', '')}`;
    const tooltipMode = useSyncExternalStore(
        subscribeToActiveMemberTooltip,
        () => (activeMemberTooltip?.id === tooltipId ? activeMemberTooltip.mode : null),
        () => null,
    );
    const open = typeof document !== 'undefined' && !dismissed && tooltipMode !== null;
    const pinned = open && tooltipMode === 'pinned';

    useTooltipPositionEffect(() => {
        if (!open) return;
        const updatePosition = () => {
            const anchor = trigger.current?.getBoundingClientRect(),
                popup = tooltip.current;
            if (!anchor || !popup) return;
            const width = Math.max(0, Math.min(360, window.innerWidth - 16));
            popup.style.width = `${width}px`;
            const maxTop = Math.max(8, window.innerHeight - popup.offsetHeight - 8);
            let top = anchor.bottom + 8;
            if (top > maxTop) {
                const above = anchor.top - popup.offsetHeight - 8;
                top = above >= 8 ? above : maxTop;
            }
            const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
            setPosition({ top: Math.max(8, Math.min(top, maxTop)), left });
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        const dismissOutside = (event: PointerEvent) => {
            const target = event.target;
            if (
                pinned &&
                target instanceof Node &&
                !trigger.current?.contains(target) &&
                !tooltip.current?.contains(target)
            ) {
                setActiveMemberTooltip(null);
            }
        };
        document.addEventListener('pointerdown', dismissOutside);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
            document.removeEventListener('pointerdown', dismissOutside);
        };
    }, [open, pinned]);

    useEffect(
        () => () => {
            if (openTimer.current !== undefined) window.clearTimeout(openTimer.current);
            if (leaveTimer.current !== undefined) window.clearTimeout(leaveTimer.current);
            if (activeMemberTooltip?.id === tooltipId) setActiveMemberTooltip(null);
        },
        [],
    );

    function cancelOpenTimer() {
        if (openTimer.current !== undefined) {
            window.clearTimeout(openTimer.current);
            openTimer.current = undefined;
        }
    }

    function cancelLeaveTimer() {
        if (leaveTimer.current !== undefined) window.clearTimeout(leaveTimer.current);
        leaveTimer.current = undefined;
    }

    function dismissTooltip() {
        cancelOpenTimer();
        cancelLeaveTimer();
        setDismissed(true);
        setActiveMemberTooltip(null);
    }

    function startHover(event: React.PointerEvent<HTMLElement>) {
        cancelOpenTimer();
        cancelLeaveTimer();
        setDismissed(false);

        const active = getActiveMemberTooltip();
        if (
            event.pointerType === 'touch' ||
            (active?.mode === 'pinned' && active.id !== tooltipId) ||
            (active?.id === tooltipId && active.mode !== 'hover')
        ) {
            return;
        }

        openTimer.current = window.setTimeout(() => {
            openTimer.current = undefined;
            setActiveMemberTooltip({ id: tooltipId, mode: 'hover' });
        }, HOVER_OPEN_DELAY_MS);
    }

    function delayHoverClose() {
        cancelOpenTimer();
        cancelLeaveTimer();
        leaveTimer.current = window.setTimeout(() => {
            leaveTimer.current = undefined;
            const active = getActiveMemberTooltip();
            if (active?.id === tooltipId && active.mode === 'hover') {
                setActiveMemberTooltip(null);
            }
        }, HOVER_CLOSE_DELAY_MS);
    }

    const popup =
        typeof document === 'undefined'
            ? null
            : createPortal(
                  <div
                      ref={tooltip}
                      id={tooltipId}
                      className="group-member-tooltip"
                      role="tooltip"
                      hidden={!open}
                      aria-hidden={!open}
                      style={position}
                      onPointerEnter={cancelLeaveTimer}
                      onPointerLeave={delayHoverClose}
                  >
                      <strong>{displayName}</strong>
                      <dl>
                          {details.map((detail, index) => {
                              const formatted = formatMemberDetailValue(detail.value, detail.field);
                              return (
                                  <div key={`${detail.label}:${index}`}>
                                      <dt>{detail.label}</dt>
                                      <dd>
                                          {detail.value !== null &&
                                          typeof detail.value === 'object' ? (
                                              <pre>{formatted}</pre>
                                          ) : (
                                              formatted
                                          )}
                                      </dd>
                                  </div>
                              );
                          })}
                      </dl>
                  </div>,
                  document.body,
              );

    return (
        <>
            <button
                ref={trigger}
                type="button"
                className={`member-detail-icon${presentation === 'card' ? ' member-detail-icon-card' : ''}`}
                aria-label={`Show details for ${displayName}${prismatic ? ', Prismatic' : ''} (hash ${hashLabel})`}
                aria-describedby={tooltipId}
                aria-expanded={open}
                onPointerEnter={startHover}
                onPointerLeave={delayHoverClose}
                onFocus={() => {
                    cancelOpenTimer();
                    cancelLeaveTimer();
                    setDismissed(false);
                    setActiveMemberTooltip({ id: tooltipId, mode: 'focus' });
                }}
                onBlur={() => {
                    const active = getActiveMemberTooltip();
                    if (active?.id === tooltipId && active.mode === 'focus') {
                        setActiveMemberTooltip(null);
                    }
                }}
                onClick={(event) => {
                    const action = memberClickAction(event);
                    if (onOpen && action === 'navigate') {
                        event.preventDefault();
                        event.stopPropagation();
                        dismissTooltip();
                        onOpen(member);
                        return;
                    }
                    if (onOpen && action === 'defer') {
                        event.preventDefault();
                        event.stopPropagation();
                        dismissTooltip();
                        return;
                    }
                    const active = getActiveMemberTooltip();
                    const wasPinned = active?.id === tooltipId && active.mode === 'pinned';
                    cancelOpenTimer();
                    cancelLeaveTimer();
                    setDismissed(wasPinned);
                    setActiveMemberTooltip(wasPinned ? null : { id: tooltipId, mode: 'pinned' });
                }}
                onDoubleClick={(event) => {
                    if (!onOpen) return;
                    event.preventDefault();
                    event.stopPropagation();
                    dismissTooltip();
                    onOpen(member);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        cancelOpenTimer();
                        cancelLeaveTimer();
                        setActiveMemberTooltip(null);
                        setDismissed(true);
                    }
                }}
            >
                <span aria-hidden="true">
                    <ManifestIcon hash={hash} size={24} table="item" nativeTitle={false} />
                </span>
                {presentation === 'card' && (
                    <span className="member-detail-card-text">
                        <span className="member-detail-card-name">{displayName}</span>
                        <small className="member-detail-card-hash mono">{hashLabel}</small>
                    </span>
                )}
            </button>
            {popup}
        </>
    );
}
