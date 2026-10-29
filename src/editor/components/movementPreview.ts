import { movementSpeed, type MovementSource, type MovementSpeedInput } from '../../core';

export interface ActiveMovementSource {
    stacks: number;
    boosted: boolean;
    held: boolean;
}

export type ActiveMovementSources = Record<string, ActiveMovementSource>;

export type MovementStatKey = 'mobility' | 'sprint' | 'walk' | 'strafe' | 'crouch' | 'ads';

export interface MovementStat {
    key: MovementStatKey;
    label: string;
    unit: 'tier' | 'm/s';
    value?: number;
    baseline?: number;
    delta?: number;
    cappedBy?: string;
    error?: string;
}

type MovementSourceEntry = MovementSource['Sources'][number];

export function movementStackCount(source: MovementSourceEntry, boosted = false): number {
    return source.Effects.reduce((max, effect) => {
        const values =
            boosted && source.BoostRequiresAll?.length
                ? (effect.BoostedValues ?? effect.Values)
                : effect.Values;
        return Math.max(max, values.length);
    }, 1);
}

export function reconcileWhileHeldSources(
    active: ActiveMovementSources,
    sources: readonly MovementSourceEntry[],
): ActiveMovementSources {
    const activeWhileHeld = sources.filter(
        (source) => source.Activation === 'WhileHeld' && active[source.Hash] !== undefined,
    );
    if (activeWhileHeld.length < 2) return active;

    const keepHash = activeWhileHeld[0]!.Hash;
    const reconciled = { ...active };
    for (const source of activeWhileHeld.slice(1)) delete reconciled[source.Hash];
    return reconciled;
}

export function reconcileMovementSources(
    active: ActiveMovementSources,
    sources: readonly MovementSourceEntry[],
): ActiveMovementSources {
    const reconciled = reconcileWhileHeldSources(active, sources);
    const entries = new Map(sources.map((source) => [String(source.Hash), source]));
    let next: ActiveMovementSources | undefined;

    for (const [hash, state] of Object.entries(reconciled)) {
        const source = entries.get(hash);
        const boosted = !!source?.BoostRequiresAll?.length && state.boosted;
        const held =
            !!source?.Effects.some((effect) => effect.Type === 'ADSMultiplier') && state.held;
        const stackCount = source ? movementStackCount(source, boosted) : 0;
        const stacks = Math.min(
            stackCount,
            Number.isSafeInteger(state.stacks) && state.stacks > 0 ? state.stacks : 1,
        );
        if (
            !source ||
            stacks !== state.stacks ||
            boosted !== state.boosted ||
            held !== state.held
        ) {
            next ??= { ...reconciled };
            if (source) next[hash] = { ...state, stacks, boosted, held };
            else delete next[hash];
        }
    }

    return next ?? reconciled;
}

export function setMovementSourceActive(
    active: ActiveMovementSources,
    sources: readonly MovementSourceEntry[],
    hash: number,
    enabled: boolean,
): ActiveMovementSources {
    const reconciled = reconcileWhileHeldSources(active, sources);
    const key = String(hash);
    if (!enabled) {
        if (reconciled[key] === undefined) return reconciled;
        const next = { ...reconciled };
        delete next[key];
        return next;
    }

    const source = sources.find((candidate) => candidate.Hash === hash);
    if (!source || reconciled[key] !== undefined) return reconciled;

    const next = { ...reconciled };
    if (source.Activation === 'WhileHeld') {
        for (const candidate of sources) {
            if (candidate.Activation === 'WhileHeld') delete next[candidate.Hash];
        }
    }
    next[key] = { stacks: 1, boosted: false, held: false };
    return next;
}

type ScenarioKey = Exclude<MovementStatKey, 'mobility'>;
type Scenario = Pick<MovementSpeedInput, 'direction' | 'posture' | 'sprint' | 'ads'>;

const scenarios: { key: ScenarioKey; label: string; input: Scenario }[] = [
    {
        key: 'sprint',
        label: 'Sprint',
        input: { direction: 'Forward', posture: 'Standing', sprint: true },
    },
    { key: 'walk', label: 'Walk', input: { direction: 'Forward', posture: 'Standing' } },
    { key: 'strafe', label: 'Strafe', input: { direction: 'Strafe', posture: 'Standing' } },
    { key: 'crouch', label: 'Crouch', input: { direction: 'Forward', posture: 'Crouched' } },
    { key: 'ads', label: 'ADS', input: { direction: 'Forward', posture: 'Standing', ads: true } },
];

interface Calculation {
    value?: number;
    tier?: number;
    cappedBy?: string;
    error?: string;
}

function calculate(
    source: MovementSource,
    classHash: number,
    activity: MovementSpeedInput['activity'],
    scenario: Scenario,
    sources: MovementSpeedInput['sources'],
    heldWeaponSources: number[],
): Calculation {
    try {
        const result = movementSpeed(
            { classHash, activity, sources, heldWeaponSources, ...scenario },
            source,
        );
        return {
            value: result.speed,
            tier: result.tier,
            ...(result.cappedBy ? { cappedBy: result.cappedBy } : {}),
        };
    } catch (cause) {
        return { error: cause instanceof Error ? cause.message : String(cause) };
    }
}

export function calculateMovementStats(
    source: MovementSource,
    classHash: number,
    activity: MovementSpeedInput['activity'],
    active: ActiveMovementSources,
): MovementStat[] {
    const activeSources = source.Sources.flatMap((entry) => {
        const state = active[entry.Hash];
        return state ? [{ hash: entry.Hash, stacks: state.stacks, boosted: state.boosted }] : [];
    });
    const heldWeaponSources = source.Sources.filter((entry) => active[entry.Hash]?.held).map(
        (entry) => entry.Hash,
    );
    const results = new Map<ScenarioKey, { baseline: Calculation; current: Calculation }>();

    for (const scenario of scenarios) {
        results.set(scenario.key, {
            baseline: calculate(source, classHash, activity, scenario.input, [], []),
            current: calculate(
                source,
                classHash,
                activity,
                scenario.input,
                activeSources,
                heldWeaponSources,
            ),
        });
    }

    const row = (
        key: MovementStatKey,
        label: string,
        unit: MovementStat['unit'],
        baseline: Calculation,
        current: Calculation,
    ): MovementStat => {
        const errors = [
            baseline.error ? `Baseline: ${baseline.error}` : '',
            current.error ? `Current: ${current.error}` : '',
        ].filter(Boolean);
        const baselineValue = unit === 'tier' ? baseline.tier : baseline.value;
        const currentValue = unit === 'tier' ? current.tier : current.value;
        return {
            key,
            label,
            unit,
            ...(baselineValue === undefined ? {} : { baseline: baselineValue }),
            ...(currentValue === undefined ? {} : { value: currentValue }),
            ...(baselineValue === undefined || currentValue === undefined
                ? {}
                : { delta: currentValue - baselineValue }),
            ...(current.cappedBy ? { cappedBy: current.cappedBy } : {}),
            ...(errors.length ? { error: errors.join(' · ') } : {}),
        };
    };

    const sprint = results.get('sprint')!,
        walk = results.get('walk')!;
    return [
        row('mobility', 'Mobility', 'tier', walk.baseline, walk.current),
        row('sprint', 'Sprint', 'm/s', sprint.baseline, sprint.current),
        row('walk', 'Walk', 'm/s', walk.baseline, walk.current),
        row(
            'strafe',
            'Strafe',
            'm/s',
            results.get('strafe')!.baseline,
            results.get('strafe')!.current,
        ),
        row(
            'crouch',
            'Crouch',
            'm/s',
            results.get('crouch')!.baseline,
            results.get('crouch')!.current,
        ),
        row('ads', 'ADS', 'm/s', results.get('ads')!.baseline, results.get('ads')!.current),
    ];
}

export interface FormattedMovementDelta {
    direction: 'increase' | 'decrease' | 'neutral';
    arrow: string;
    text: string;
    accessibleLabel: string;
}

function formatDeltaAmount(value: number): string {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
        useGrouping: false,
    }).format(Math.abs(value));
}

export function formatMovementDelta(
    delta: number,
    unit: MovementStat['unit'],
): FormattedMovementDelta {
    const rounded = Number(delta.toFixed(6));
    const unitLabel = unit === 'tier' ? 'tier' : 'm/s';
    const pluralizedUnit = unit === 'tier' && Math.abs(rounded) !== 1 ? 'tiers' : unitLabel;
    if (rounded === 0) {
        return {
            direction: 'neutral',
            arrow: '—',
            text: `0.00 ${unit === 'tier' ? 'tiers' : 'm/s'}`,
            accessibleLabel: 'No change from the global-only baseline',
        };
    }
    const direction = rounded > 0 ? 'increase' : 'decrease';
    const amount = formatDeltaAmount(rounded);
    return {
        direction,
        arrow: direction === 'increase' ? '↑' : '↓',
        text: `${rounded > 0 ? '+' : '-'}${amount} ${pluralizedUnit}`,
        accessibleLabel: `${direction === 'increase' ? 'Increase' : 'Decrease'} of ${amount} ${pluralizedUnit} from the global-only baseline`,
    };
}
