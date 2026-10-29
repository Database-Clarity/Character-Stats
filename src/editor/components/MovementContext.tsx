import { useEffect, useMemo, useState } from 'react';
import { validateSources, type MovementSource, type MovementSpeedInput } from '../../core';
import { HashIdentity } from './ManifestUI';
import { formatMovementSpeed } from './previewData';
import {
    calculateMovementStats,
    formatMovementDelta,
    movementStackCount,
    reconcileMovementSources,
    reconcileWhileHeldSources,
    setMovementSourceActive,
    type ActiveMovementSource,
    type ActiveMovementSources,
} from './movementPreview';

function validMovement(value: unknown): value is MovementSource {
    return !validateSources({ stats: [], movement: value }).some(
        (issue) =>
            issue.severity === 'error' &&
            (issue.path === 'movement' || issue.path.startsWith('movement.')),
    );
}

export function MovementContext({ value }: { value: unknown }) {
    if (!validMovement(value))
        return (
            <aside className="context" aria-label="Movement preview">
                <header className="pane-header">
                    <strong>Speed preview</strong>
                </header>
                <p className="error empty-state">
                    Fix Movement validation errors before previewing speed.
                </p>
            </aside>
        );
    return <MovementControls source={value} />;
}

function MovementControls({ source }: { source: MovementSource }) {
    const [classHash, setClassHash] = useState(source.Classes[0]?.ClassHash ?? 0);
    const [activity, setActivity] = useState<MovementSpeedInput['activity']>('PVE');
    const [activeState, setActiveState] = useState<ActiveMovementSources>({});
    const active = useMemo(
        () => reconcileMovementSources(activeState, source.Sources),
        [activeState, source.Sources],
    );
    useEffect(() => {
        if (active !== activeState) setActiveState(active);
    }, [active, activeState]);
    const stats = calculateMovementStats(source, classHash, activity, active);

    function update(hash: number, patch: Partial<ActiveMovementSource>) {
        setActiveState((current) => {
            const reconciled = reconcileMovementSources(current, source.Sources);
            const state = reconciled[hash];
            return state
                ? reconcileMovementSources(
                      { ...reconciled, [hash]: { ...state, ...patch } },
                      source.Sources,
                  )
                : reconciled;
        });
    }

    return (
        <aside className="context movement-context" aria-label="Movement preview">
            <header className="pane-header">
                <strong>Speed preview</strong>
            </header>
            <section className="movement-settings" aria-label="Global movement settings">
                <label className="inline">
                    Class
                    <select
                        aria-label="Preview class"
                        value={classHash}
                        onChange={(e) => setClassHash(Number(e.target.value))}
                    >
                        {!source.Classes.some((entry) => entry.ClassHash === classHash) && (
                            <option value={classHash}>Choose class</option>
                        )}
                        {source.Classes.map((entry) => (
                            <option key={entry.ClassHash} value={entry.ClassHash}>
                                {entry.Name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="inline">
                    Activity
                    <select
                        aria-label="Activity"
                        value={activity}
                        onChange={(e) => setActivity(e.target.value === 'PVP' ? 'PVP' : 'PVE')}
                    >
                        <option value="PVE">PvE</option>
                        <option value="PVP">PvP</option>
                    </select>
                </label>
            </section>
            <section
                className="movement-summary"
                aria-label="Calculated movement stats"
                aria-describedby="movement-summary-baseline"
            >
                <div className="movement-summary-heading">
                    <strong>Movement stats</strong>
                    <span id="movement-summary-baseline">Δ vs global-only baseline</span>
                </div>
                <ul className="movement-stats">
                    {stats.map((stat) => {
                        const delta =
                            stat.delta === undefined
                                ? undefined
                                : formatMovementDelta(stat.delta, stat.unit);
                        return (
                            <li
                                className="movement-stat"
                                data-stat-key={stat.key}
                                data-value={stat.value}
                                data-baseline={stat.baseline}
                                data-delta={stat.delta}
                                key={stat.key}
                            >
                                <span className="movement-stat-label">{stat.label}</span>
                                <span className="movement-stat-value">
                                    <strong>
                                        {stat.value === undefined
                                            ? 'Unavailable'
                                            : stat.key === 'mobility'
                                              ? `Tier ${formatMovementTier(stat.value)}`
                                              : `${formatMovementSpeed(stat.value)} m/s`}
                                    </strong>
                                </span>
                                <span className="movement-stat-cap" title={stat.cappedBy}>
                                    {stat.unit === 'm/s' && stat.value !== undefined
                                        ? `Cap: ${stat.cappedBy?.replace('SpeedCap', '') ?? 'none'}`
                                        : ''}
                                </span>
                                {delta && (
                                    <span
                                        className={`movement-delta movement-delta--${delta.direction}`}
                                        data-delta-direction={delta.direction}
                                        aria-label={delta.accessibleLabel}
                                    >
                                        <span aria-hidden="true">{delta.arrow}</span> {delta.text}
                                    </span>
                                )}
                                {stat.error && (
                                    <small className="movement-stat-error" role="alert">
                                        {stat.error}
                                    </small>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </section>
            <section className="movement-source-selection" aria-label="Active sources">
                <header className="movement-source-heading">
                    <strong>Active sources</strong>
                </header>
                <p className="help">
                    Select only sources whose conditions are met. Another WhileHeld choice replaces
                    the current one; uncheck it to clear it. Other sources stay selected.
                </p>
                <div className="scroll-pane movement-source-list">
                    {source.Sources.map((entry) => {
                        const state = active[entry.Hash];
                        return (
                            <div className="movement-source" key={entry.Hash}>
                                <label className="check">
                                    <input
                                        type="checkbox"
                                        aria-label={`Activate ${entry.Name}`}
                                        checked={!!state}
                                        onChange={(e) => {
                                            const enabled = e.currentTarget.checked;
                                            setActiveState((current) =>
                                                setMovementSourceActive(
                                                    current,
                                                    source.Sources,
                                                    entry.Hash,
                                                    enabled,
                                                ),
                                            );
                                        }}
                                    />
                                    <HashIdentity
                                        hash={entry.Hash}
                                        name={entry.Name}
                                        table={entry.RefType}
                                        compact
                                    />
                                </label>
                                <small className="muted">{entry.Activation}</small>
                                {state && (
                                    <div className="movement-source-controls">
                                        <div className="movement-stack-control">
                                            <span>Stacks</span>
                                            <div
                                                className="movement-stack-options"
                                                role="group"
                                                aria-label={`${entry.Name} stacks`}
                                            >
                                                {Array.from(
                                                    { length: movementStackCount(entry, state.boosted) },
                                                    (_, index) => index + 1,
                                                ).map((stacks) => (
                                                    <button
                                                        key={stacks}
                                                        type="button"
                                                        aria-label={`${stacks} stack${stacks === 1 ? '' : 's'}`}
                                                        aria-pressed={state.stacks === stacks}
                                                        onClick={() =>
                                                            update(entry.Hash, { stacks })
                                                        }
                                                    >
                                                        {stacks}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {!!entry.BoostRequiresAll?.length && (
                                            <label
                                                className="check"
                                                title={`Requires all: ${entry.BoostRequiresAll.join(', ')}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={state.boosted}
                                                    onChange={(e) =>
                                                        update(entry.Hash, {
                                                            boosted: e.target.checked,
                                                        })
                                                    }
                                                />
                                                Boosted
                                            </label>
                                        )}
                                        {entry.Effects.some(
                                            (effect) => effect.Type === 'ADSMultiplier',
                                        ) && (
                                            <label className="check">
                                                <input
                                                    type="checkbox"
                                                    checked={state.held}
                                                    onChange={(e) =>
                                                        update(entry.Hash, {
                                                            held: e.currentTarget.checked,
                                                        })
                                                    }
                                                />
                                                Held ADS
                                            </label>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>
        </aside>
    );
}

function formatMovementTier(tier: number): string {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 6,
        useGrouping: false,
    }).format(tier);
}
