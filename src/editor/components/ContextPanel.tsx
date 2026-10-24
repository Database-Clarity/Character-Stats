import { useState } from 'react';
import {
    effectiveCooldown,
    isRecord,
    isAbilityRole,
    type Ability,
    type SuperAbility,
    type Override,
    type StatSource,
} from '../../core';
import { Collapse, StatControl } from './EditorPrimitives';
import { HashIdentity } from './ManifestUI';
import { isPreviewAbility, isPreviewOverride, previewCollections } from './previewData';

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
    const { abilities: allAbilities, overrides, collections } = previewCollections(source);
    const abilities = allAbilities.filter(isPreviewAbility);
    if (!isRecord(source.Fields) || !source.Fields.CooldownScalars || !abilities.length)
        return (
            <aside className="context">
                <div className="pane-header">
                    <strong>Context</strong>
                </div>
                <p className="empty-state">No cooldown context for this collection.</p>
            </aside>
        );
    function result(ability: Ability | SuperAbility, applied: Override[]) {
        try {
            const calculated = effectiveCooldown(source, ability, statValue, applied);
            return Number.isFinite(calculated.cooldown) ? calculated : undefined;
        } catch {
            return undefined;
        }
    }
    const role = collections[collection]?.role;
    const selectedAbility =
        isAbilityRole(role) && isPreviewAbility(selected) ? selected : undefined;
    const selectedOverride =
        role === 'override' && isPreviewOverride(selected) ? selected : undefined;
    const selectedBase = selectedAbility ? result(selectedAbility, []) : undefined;
    const rows = selectedAbility
        ? overrides.flatMap((override) => {
              const base = selectedBase,
                  applied = result(selectedAbility, [override]);
              return applied?.appliedOverrides.includes(override.Hash)
                  ? [
                        {
                            hash: override.Hash,
                            name: override.Name,
                            before: base?.cooldown,
                            after: applied.cooldown,
                        },
                    ]
                  : [];
          })
        : selectedOverride
          ? abilities.flatMap((ability) => {
                const base = result(ability, []),
                    applied = result(ability, [selectedOverride]);
                return applied?.appliedOverrides.includes(selectedOverride.Hash)
                    ? [
                          {
                              hash: ability.Hash,
                              name: ability.Name,
                              before: base?.cooldown,
                              after: applied.cooldown,
                          },
                      ]
                    : [];
            })
          : [];
    const unresolved = (
        selectedOverride ? [selectedOverride] : selectedAbility ? overrides : []
    ).filter((o) => o.Requirements.some((r) => r < 0));
    return (
        <aside className="context">
            <div className="pane-header">
                <strong>Cooldown context</strong>
                <span className="muted">seconds</span>
            </div>
            <div className="pinned-controls">
                <StatControl label="Context stat value" value={statValue} onChange={setStatValue} />
                <p className="help">Core calculation · cooldown stat clamps at 100.</p>
            </div>
            <div className="scroll-pane context-body">
                {!selected ? (
                    <p className="empty-state">
                        Select an ability or override to inspect its effects.
                    </p>
                ) : (
                    <>
                        {!selectedAbility && !selectedOverride && (
                            <p className="warning">
                                Invalid item data; fix validation errors to preview cooldowns.
                            </p>
                        )}
                        {selectedAbility && (
                            <div className="context-base">
                                <HashIdentity
                                    hash={selectedAbility.Hash}
                                    name={selectedAbility.Name}
                                />
                                <strong className="mono">
                                    {selectedBase ? `${selectedBase.cooldown} s` : 'Invalid data'}
                                </strong>
                                <small>Base cooldown at {statValue}</small>
                            </div>
                        )}
                        <Collapse
                            storageKey={`${source.Name}:${collection}:context`}
                            title={selectedAbility ? 'Applicable overrides' : 'Affected abilities'}
                        >
                            <div className="table-scroll context-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{selectedAbility ? 'Override' : 'Ability'}</th>
                                            <th>Before → after</th>
                                            <th>Δ s</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr key={row.hash}>
                                                <th>
                                                    <HashIdentity
                                                        hash={row.hash}
                                                        name={row.name}
                                                        compact
                                                    />
                                                </th>
                                                <td className="mono">
                                                    {row.before ?? '—'} → {row.after ?? '—'}
                                                </td>
                                                <td className="mono info">
                                                    {row.before === undefined ||
                                                    row.after === undefined
                                                        ? '—'
                                                        : `${row.after - row.before > 0 ? '+' : ''}${Number((row.after - row.before).toFixed(3))}`}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {!rows.length && (
                                    <p className="help">No resolved applicable effects.</p>
                                )}
                            </div>
                        </Collapse>
                        {unresolved.length > 0 && (
                            <Collapse
                                storageKey={`${source.Name}:unresolved`}
                                title="Unresolved subclass filters"
                            >
                                {unresolved.map((o) => (
                                    <p key={o.Hash} className="warning">
                                        <HashIdentity hash={o.Hash} name={o.Name} compact />{' '}
                                        unresolved: subclass filter
                                    </p>
                                ))}
                            </Collapse>
                        )}
                    </>
                )}
            </div>
        </aside>
    );
}
