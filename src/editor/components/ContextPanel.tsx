import { useState } from 'react';
import {
    effectiveCooldown,
    isRecord,
    type Ability,
    type SuperAbility,
    type Override,
    type StatSource,
} from '../../core';
export function ContextPanel({
    source,
    collection,
    selected,
}: {
    source: StatSource;
    collection: string;
    selected: Record<string, unknown> | undefined;
}) {
    const [statValue, setStatValue] = useState(100);
    const collectionItems = Array.isArray(source.Abilities)
        ? source.Abilities
        : Array.isArray(source.SuperAbilities)
          ? source.SuperAbilities
          : [];
    const abilities = collectionItems.filter(isRecord);
    if (!isRecord(source.Fields) || !source.Fields.CooldownScalars || !abilities.length)
        return null;
    const overrides = Array.isArray(source.Overrides) ? source.Overrides.filter(isRecord) : [];
    function result(ability: Ability | SuperAbility, applied: Override[]) {
        try {
            return effectiveCooldown(source, ability, statValue, applied);
        } catch {
            return undefined;
        }
    }
    const selectedAbility =
        collection === 'Overrides'
            ? undefined
            : abilities.find((ability) => ability.Hash === selected?.Hash);
    const chosenOverrides =
        collection === 'Overrides' && selected ? [selected as unknown as Override] : overrides;
    return (
        <aside className="context card">
            <h3>Cooldown context</h3>
            <label>
                Context stat value: {statValue}
                <input
                    aria-label="Context stat value"
                    type="range"
                    min={0}
                    max={200}
                    value={statValue}
                    onChange={(e) => setStatValue(Number(e.target.value))}
                />
            </label>
            <p className="help">
                Calculated by the shared core. Stat values above 100 clamp to 100 for cooldowns.
                Negative subclass requirements remain unresolved.
            </p>
            <div className="table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th>Ability</th>
                            <th>No overrides (s)</th>
                            <th>
                                {collection === 'Overrides'
                                    ? 'Selected override (s)'
                                    : 'All overrides (s)'}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {abilities.map((ability) => {
                            const base = result(ability, []),
                                applied = result(ability, chosenOverrides);
                            return (
                                <tr key={ability.Hash}>
                                    <th>
                                        {ability.Name}
                                        {selectedAbility?.Hash === ability.Hash
                                            ? ' • selected'
                                            : ''}
                                    </th>
                                    <td>{base?.cooldown ?? 'Invalid data'}</td>
                                    <td>
                                        {applied?.cooldown ?? 'Invalid data'}
                                        {applied?.unresolved.length ? ' (unresolved subclass)' : ''}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {selectedAbility && (
                <>
                    <h4>Each applicable override</h4>
                    <ul>
                        {overrides.map((override) => {
                            const applied = result(selectedAbility, [override]);
                            return applied?.appliedOverrides.includes(override.Hash) ? (
                                <li key={override.Hash}>
                                    {override.Name}: {applied.cooldown}s
                                </li>
                            ) : null;
                        })}
                    </ul>
                </>
            )}
        </aside>
    );
}
