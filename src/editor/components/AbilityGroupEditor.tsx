import type { EntitySpec } from '../../core';
import { updateEntityGroupField, equal, sharedEntityFields } from '../state/editing';
import { FieldInput } from './FieldInput';
import { MemberDetailIcon } from './MemberDetailIcon';

export function AbilityGroupEditor({
    spec,
    items,
    members,
    memberIds,
    idKey,
    collection,
    file,
    savedById,
    getManifestName,
    hasContext,
    contextOpen,
    onToggleContext,
    onOpenMember,
    onChange,
}: {
    spec: EntitySpec;
    items: Record<string, unknown>[];
    members: Record<string, unknown>[];
    memberIds: string[];
    idKey: string;
    collection: string;
    file: string;
    savedById: Map<string, Record<string, unknown>>;
    getManifestName(hash: number, member: Record<string, unknown>): string | undefined;
    hasContext: boolean;
    contextOpen: boolean;
    onToggleContext(): void;
    onOpenMember(member: Record<string, unknown>): void;
    onChange(next: Record<string, unknown>[]): void;
}) {
    const first = members[0]!;
    const fields = sharedEntityFields(spec, members, idKey);
    return (
        <section className="item-editor" aria-label="Edit cooldown group">
            <header className="pane-header editor-header">
                <div className="cooldown-group-title">
                    <strong>Cooldown group</strong>
                    <span className="muted">
                        {members.length} entries · {String(first.BaseCooldown)} s base cooldown
                    </span>
                </div>
                <div className="toolbar">
                    {hasContext && (
                        <button
                            className="context-toggle"
                            aria-pressed={contextOpen}
                            onClick={onToggleContext}
                        >
                            Context
                        </button>
                    )}
                </div>
            </header>
            <div className="scroll-pane editor-body">
                <p className="help">
                    Changes apply to every entry. Only shared fields appear. Hash identities and
                    Overrides remain unchanged.
                </p>
                {fields.map((field) => {
                    const savedValues = members.map(
                        (member) => savedById.get(String(member[idKey]))?.[field.key],
                    );
                    const modified = members.some(
                        (member, index) => !equal(member[field.key], savedValues[index]),
                    );
                    return (
                        <FieldInput
                            key={field.key}
                            spec={field}
                            value={first[field.key]}
                            saved={savedValues[0]}
                            modified={modified}
                            revertTitle="Restore this field to each entry's saved value"
                            siblings={first}
                            file={file}
                            path={`${collection}:group:${memberIds.join(',')}.${field.key}`}
                            fieldPath={`${collection} group.${field.key}`}
                            onChange={(value) =>
                                onChange(
                                    updateEntityGroupField(
                                        items,
                                        idKey,
                                        memberIds,
                                        field.key,
                                        () => value,
                                    ),
                                )
                            }
                            onRevert={() =>
                                onChange(
                                    updateEntityGroupField(
                                        items,
                                        idKey,
                                        memberIds,
                                        field.key,
                                        (member) =>
                                            savedById.get(String(member[idKey]))?.[field.key],
                                    ),
                                )
                            }
                        />
                    );
                })}
                {!fields.length && (
                    <p className="empty-state">No fields other than identity are shared.</p>
                )}
                <section className="cooldown-group-members" aria-label="Cooldown group members">
                    <strong>Members</strong>
                    <div className="member-detail-icon-grid" role="group">
                        {members.map((member) => {
                            const hash = Number(member[idKey]);
                            return (
                                <MemberDetailIcon
                                    key={String(member[idKey])}
                                    spec={spec}
                                    member={member}
                                    name={getManifestName(hash, member)}
                                    presentation="card"
                                    onOpen={onOpenMember}
                                />
                            );
                        })}
                    </div>
                </section>
            </div>
        </section>
    );
}
