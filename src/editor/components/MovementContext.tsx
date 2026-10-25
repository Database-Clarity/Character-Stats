import { useState } from 'react';
import {
    movementSpeed,
    validateSources,
    type MovementSource,
    type MovementSpeedInput,
    type MovementSpeedResult,
} from '../../core';
import { HashIdentity } from './ManifestUI';
import { formatMovementSpeed } from './previewData';
import { NumberInput } from './NumberInput';

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
    const [direction, setDirection] = useState<MovementSpeedInput['direction']>('Forward');
    const [posture, setPosture] = useState<MovementSpeedInput['posture']>('Standing');
    const [sprint, setSprint] = useState(false);
    const [ads, setAds] = useState(false);
    const [active, setActive] = useState<
        Record<string, { stacks: number; boosted: boolean; held: boolean }>
    >({});
    const selected = source.Sources.filter((entry) => active[entry.Hash]);
    let result: MovementSpeedResult | undefined;
    let error = '';
    try {
        result = movementSpeed(
            {
                classHash,
                activity,
                direction,
                posture,
                sprint,
                ads,
                sources: selected.map((entry) => ({ hash: entry.Hash, ...active[entry.Hash]! })),
                heldWeaponSources: selected
                    .filter((entry) => active[entry.Hash]!.held)
                    .map((entry) => entry.Hash),
            },
            source,
        );
    } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
    }
    function update(
        hash: number,
        patch: Partial<{ stacks: number; boosted: boolean; held: boolean }>,
    ) {
        setActive((current) => ({ ...current, [hash]: { ...current[hash]!, ...patch } }));
    }
    return (
        <aside className="context movement-context" aria-label="Movement preview">
            <header className="pane-header">
                <strong>Speed preview</strong>
                <span className="muted">m/s</span>
            </header>
            <div className="pinned-controls">
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
                <label className="inline">
                    Direction
                    <select
                        aria-label="Direction"
                        value={direction}
                        onChange={(e) => {
                            setDirection(e.target.value === 'Strafe' ? 'Strafe' : 'Forward');
                            setSprint(false);
                        }}
                    >
                        <option>Forward</option>
                        <option>Strafe</option>
                    </select>
                </label>
                <label className="inline">
                    Posture
                    <select
                        aria-label="Posture"
                        value={posture}
                        onChange={(e) => {
                            setPosture(e.target.value === 'Crouched' ? 'Crouched' : 'Standing');
                            setSprint(false);
                        }}
                    >
                        <option>Standing</option>
                        <option>Crouched</option>
                    </select>
                </label>
                <div className="toolbar">
                    <label className="check">
                        <input
                            type="checkbox"
                            checked={sprint}
                            onChange={(e) => {
                                setSprint(e.target.checked);
                                if (e.target.checked) {
                                    setDirection('Forward');
                                    setPosture('Standing');
                                    setAds(false);
                                }
                            }}
                        />
                        Sprint
                    </label>
                    <label className="check">
                        <input
                            type="checkbox"
                            checked={ads}
                            onChange={(e) => {
                                setAds(e.target.checked);
                                if (e.target.checked) setSprint(false);
                            }}
                        />
                        ADS
                    </label>
                </div>
                <div className="movement-result" aria-live="polite">
                    {result ? (
                        <>
                            <strong className="mono">
                                {formatMovementSpeed(result.speed)} m/s
                            </strong>
                            <span>Tier {result.tier}</span>
                            <span className="muted">Cap: {result.cappedBy ?? 'none'}</span>
                        </>
                    ) : (
                        <p className="error">{error}</p>
                    )}
                </div>
            </div>
            <div className="scroll-pane context-body">
                <strong>Active sources</strong>
                <p className="help">
                    Select only sources whose activation conditions are met. Held ADS selects
                    sources for one weapon, not the whole loadout. Boosted asserts all prerequisites
                    are equipped.
                </p>
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
                                        const next = { ...active };
                                        if (e.target.checked)
                                            next[entry.Hash] = {
                                                stacks: 1,
                                                boosted: false,
                                                held: false,
                                            };
                                        else delete next[entry.Hash];
                                        setActive(next);
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
                                    <label>
                                        Stacks{' '}
                                        <NumberInput
                                            aria-label={`${entry.Name} stacks`}
                                            step={1}
                                            constraints={{ min: 1 }}
                                            value={
                                                Number.isFinite(state.stacks) ? state.stacks : ''
                                            }
                                            onChangeValue={(raw) =>
                                                update(entry.Hash, {
                                                    stacks: raw === '' ? NaN : Number(raw),
                                                })
                                            }
                                        />
                                    </label>
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
                                                    update(entry.Hash, { held: e.target.checked })
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
        </aside>
    );
}
