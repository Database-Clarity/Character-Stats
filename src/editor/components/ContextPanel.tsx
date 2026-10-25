import { useState } from 'react';
import {
    effectiveCooldown,
    isRecord,
    isAbilityRole,
    type Ability,
    type SuperAbility,
    type Override,
    type EntitySpec,
    type StatSource,
} from '../../core';
import { Collapse, StatControl } from './EditorPrimitives';
import { HashIdentity } from './ManifestUI';
import { MemberDetailIcon } from './MemberDetailIcon';
import { isPreviewAbility, isPreviewOverride, previewCollections } from './previewData';

export function ContextPanel({
    source,
    collection,
    selected,
    groupMembers,
    onOpenMember,
}: {
    source: StatSource;
    collection: string;
    selected: Record<string, unknown> | undefined;
    groupMembers?: readonly Record<string, unknown>[] | undefined;
    onOpenMember?(collection: string, member: Record<string, unknown>): void;
}) {
    const [statValue, setStatValue] = useState(100);
    const { abilities: allAbilities, overrides, collections } = previewCollections(source);
    const abilities = allAbilities.filter(isPreviewAbility);
    const abilityCollectionSpecs = Object.entries(collections).filter(([, spec]) =>
        isAbilityRole(spec.role),
    );
    const scaled = isRecord(source.Fields) && source.Fields.CooldownScalars !== undefined;
    const selectedGroup = groupMembers?.filter(isPreviewAbility) ?? [];
    const invalidGroupMembers = (groupMembers?.length ?? 0) - selectedGroup.length;
    if (!abilities.length && groupMembers === undefined)
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
    function memberSpecFor(member: Record<string, unknown>): [string, EntitySpec] | undefined {
        const byIdentity = abilityCollectionSpecs.find(([key]) => {
            const items = isRecord(source) ? source[key] : undefined;
            return Array.isArray(items) && items.some((item) => item === member);
        });
        if (byIdentity) return byIdentity;
        const byHash = abilityCollectionSpecs.find(([key]) => {
            const items = isRecord(source) ? source[key] : undefined;
            return (
                Array.isArray(items) &&
                items.some((item) => isRecord(item) && item.Hash === member.Hash)
            );
        });
        if (byHash) return byHash;
        const selectedCollectionSpec = collections[collection];
        if (selectedCollectionSpec && isAbilityRole(selectedCollectionSpec.role))
            return [collection, selectedCollectionSpec];
        return undefined;
    }
    function memberIconGrid(
        members: readonly Record<string, unknown>[],
        label: string,
    ): React.JSX.Element {
        if (!members.every(memberSpecFor)) {
            return (
                <span className="warning">
                    Ability details are unavailable because this stat has no ability schema.
                </span>
            );
        }
        return (
            <div
                className="member-detail-icon-grid context-member-icon-grid"
                role="group"
                aria-label={label}
                data-min-columns={Math.min(members.length, 3)}
            >
                {members.map((member) => {
                    const memberCollection = memberSpecFor(member);
                    if (!memberCollection) return null;
                    const [memberCollectionKey, spec] = memberCollection;
                    return (
                        <MemberDetailIcon
                            key={String(member.Hash ?? member.Name)}
                            spec={spec}
                            member={member}
                            {...(onOpenMember
                                ? { onOpen: () => onOpenMember(memberCollectionKey, member) }
                                : {})}
                        />
                    );
                })}
            </div>
        );
    }
    const selectedBase = selectedAbility ? result(selectedAbility, []) : undefined;
    const groupOverrideEffects = selectedGroup.flatMap((ability) => {
        const base = result(ability, []);
        return overrides.flatMap((override) => {
            const applied = result(ability, [override]);
            return applied?.appliedOverrides.includes(override.Hash)
                ? [{ ability, override, before: base?.cooldown, after: applied.cooldown }]
                : [];
        });
    });
    const groupedOverrideEffects = Array.from(
        groupOverrideEffects.reduce(
            (groups, row) => {
                const key = JSON.stringify([row.override.Hash, row.before ?? null, row.after]);
                const group = groups.get(key) ?? { ...row, members: [] };
                group.members.push(row.ability);
                groups.set(key, group);
                return groups;
            },
            new Map<
                string,
                (typeof groupOverrideEffects)[number] & {
                    members: (typeof selectedGroup)[number][];
                }
            >(),
        ),
    ).map(([, group]) => group);
    const rows = selectedAbility
        ? overrides.flatMap((override) => {
              const base = selectedBase,
                  applied = result(selectedAbility, [override]);
              return applied?.appliedOverrides.includes(override.Hash)
                  ? [
                        {
                            hash: override.Hash,
                            name: override.Name,
                            member: undefined,
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
                              member: ability,
                              before: base?.cooldown,
                              after: applied.cooldown,
                          },
                      ]
                    : [];
            })
          : [];
    const unresolved = (
        selectedOverride
            ? [selectedOverride]
            : selectedAbility || groupMembers !== undefined
              ? overrides
              : []
    ).filter((o) => o.Requirements.some((r) => r < 0));
    return (
        <aside className="context">
            <div className="pane-header">
                <strong>Cooldown context</strong>
                <span className="muted">seconds</span>
            </div>
            {scaled && (
                <div className="pinned-controls">
                    <StatControl
                        label="Context stat value"
                        value={statValue}
                        onChange={setStatValue}
                    />
                    <p className="help">Core calculation · cooldown stat clamps at 100.</p>
                </div>
            )}
            <div
                className={`scroll-pane context-body${groupMembers !== undefined ? ' context-body-with-group' : ''}`}
            >
                {!selected && groupMembers === undefined ? (
                    <p className="empty-state">
                        Select an ability, cooldown group, or override to inspect its effects.
                    </p>
                ) : (
                    <>
                        {!selectedAbility && !selectedOverride && groupMembers === undefined && (
                            <p className="warning">
                                Invalid item data; fix validation errors to preview cooldowns.
                            </p>
                        )}
                        {invalidGroupMembers > 0 && (
                            <p className="warning">
                                {invalidGroupMembers} group{' '}
                                {invalidGroupMembers === 1 ? 'entry is' : 'entries are'} invalid;
                                valid members are shown below.
                            </p>
                        )}
                        {groupMembers !== undefined && (
                            <>
                                {!selectedGroup.length && (
                                    <p className="empty-state">
                                        No valid group members for override context.
                                    </p>
                                )}
                                <Collapse
                                    storageKey={`${source.Name}:${collection}:context-group`}
                                    title="Applicable overrides"
                                    className="context-group-overrides-collapse"
                                >
                                    <div className="table-scroll context-table">
                                        <table className="context-group-overrides-table">
                                            <thead>
                                                <tr>
                                                    <th>Override</th>
                                                    <th>Abilities</th>
                                                    <th>
                                                        Before <span className="mono">→</span> after
                                                    </th>
                                                    <th>Δ s</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groupedOverrideEffects.map((row) => (
                                                    <tr
                                                        key={JSON.stringify([
                                                            row.override.Hash,
                                                            row.before ?? null,
                                                            row.after,
                                                        ])}
                                                    >
                                                        <th>
                                                            <HashIdentity
                                                                hash={row.override.Hash}
                                                                name={row.override.Name}
                                                                compact
                                                            />
                                                        </th>
                                                        <td>
                                                            {memberIconGrid(
                                                                row.members,
                                                                `Abilities affected by ${row.override.Name}`,
                                                            )}
                                                        </td>
                                                        <td className="mono">
                                                            {row.before ?? '—'} → {row.after}
                                                        </td>
                                                        <td className="mono info">
                                                            {row.before === undefined
                                                                ? '—'
                                                                : `${row.after - row.before > 0 ? '+' : ''}${Number((row.after - row.before).toFixed(3))}`}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {!groupedOverrideEffects.length && (
                                            <p className="help">No resolved applicable effects.</p>
                                        )}
                                    </div>
                                </Collapse>
                            </>
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
                                <small>
                                    {scaled && statValue < 100
                                        ? `Cooldown at ${statValue} ${source.Name}`
                                        : 'Base cooldown'}
                                </small>
                            </div>
                        )}
                        {(selectedAbility || selectedOverride) && (
                            <Collapse
                                storageKey={`${source.Name}:${collection}:context`}
                                title={
                                    selectedAbility ? 'Applicable overrides' : 'Affected abilities'
                                }
                            >
                                <div className="table-scroll context-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>{selectedAbility ? 'Override' : 'Ability'}</th>
                                                <th>
                                                    Before <span className="mono">→</span> after
                                                </th>
                                                <th>Δ s</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row) => (
                                                <tr key={row.hash}>
                                                    <th>
                                                        {row.member ? (
                                                            memberIconGrid(
                                                                [row.member],
                                                                `Ability affected by ${selectedOverride?.Name ?? 'selected override'}`,
                                                            )
                                                        ) : (
                                                            <HashIdentity
                                                                hash={row.hash}
                                                                name={row.name}
                                                                compact
                                                            />
                                                        )}
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
                        )}
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
