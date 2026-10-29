import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
    isRecord,
    validateEntity,
    type EntitySpec,
    type StatSource,
    type StatSpec,
} from '../../core';
import { useEditor } from '../state/store';
import {
    type EntityFormSession,
    createItemDraft,
    equal,
    followEntityIdentity,
    hasDraftIdentity,
    identityKey,
    indexEntityRows,
    selectEntityFormSession,
} from '../state/editing';
import { useManifest } from '../manifest';
import { ManifestPicker, collectionFilter } from './ManifestUI';
import { type ItemAction } from './ItemMenu';
import { previewCollections } from './previewData';
import { ContextPanel } from './ContextPanel';
import { EntityRows } from './EntityRows';
import { ItemEditorPane } from './ItemEditorPane';
import { AbilityGroupEditor } from './AbilityGroupEditor';
import {
    consumeWheelNavigation,
    nextCollectionSelection,
    normalizeWheelDeltaY,
    type WheelNavigationState,
} from './navigationShortcuts';
import type { NavigationMode } from './navigationHistory';

export function EntityList({
    spec,
    items,
    file,
    collection,
    stat,
    statSpec,
    source,
    entrySource,
    selected,
    groupMembers: selectedGroupMembers,
    onSelect,
    onNavigate,
    onNavigateGroup,
    onChange,
    context,
    onOpenMember,
}: {
    spec: EntitySpec;
    items: Record<string, unknown>[];
    file: string;
    collection: string;
    stat: string;
    statSpec: StatSpec;
    source: StatSource;
    entrySource: Record<string, unknown>;
    selected: string | null;
    groupMembers: string[] | undefined;
    onSelect(key: string | null): void;
    onNavigate(key: string | null, mode: NavigationMode): void;
    onNavigateGroup(memberIds: string[]): void;
    onChange(next: Record<string, unknown>[]): void;
    context?: ReactNode;
    onOpenMember(collection: string, key: string): void;
}) {
    const [formSession, setFormSession] = useState<EntityFormSession>(() => ({
        selected,
        baseline: selected,
        token: 0,
    }));
    const [search, setSearch] = useState(''),
        [picker, setPicker] = useState(false),
        [contextOpen, setContextOpen] = useState(false);
    const editingGroup = selectedGroupMembers ?? null;
    const layout = useRef<HTMLDivElement>(null),
        wheelNavigation = useRef<WheelNavigationState>({
            accumulated: 0,
            direction: null,
            lastNavigation: 0,
        });
    const { originalValues, itemDrafts, dispatch } = useEditor();
    const { lookup } = useManifest();
    function manifestTable(item: Record<string, unknown>) {
        return item.RefType === 'itemCategory'
            ? ('itemCategory' as const)
            : item.RefType === 'item'
              ? ('item' as const)
              : spec.role === 'movementClass'
                ? ('class' as const)
                : undefined;
    }
    const idKey = identityKey(spec),
        draftKey = `${file}:${collection}`,
        draft = itemDrafts[draftKey];
    const originalFile = originalValues[file];
    const oldFile = isRecord(originalFile) ? originalFile : {};
    const saved = (Array.isArray(oldFile[collection]) ? oldFile[collection] : []).filter(isRecord);
    const { currentById, savedById, rows: indexedRows } = indexEntityRows(items, saved, idKey);
    const current = selected === 'draft' ? draft : selected ? currentById.get(selected) : undefined;
    const editingMembers =
        editingGroup?.map((id) => currentById.get(id)).filter((item) => item !== undefined) ?? [];
    const contextGroupMembers =
        editingGroup && editingMembers.length === editingGroup.length && editingMembers.length > 1
            ? editingMembers
            : undefined;
    const original =
        selected && selected !== 'draft'
            ? savedById.get(formSession.baseline ?? selected)
            : undefined;
    const deleted = !!original && !current;
    const editorValue = current ?? original;
    const identity = editorValue?.[idKey];
    const hash = typeof identity === 'number' && Number.isFinite(identity) ? identity : Number.NaN;
    const manifest = Number.isFinite(hash)
        ? lookup(hash, editorValue ? manifestTable(editorValue) : undefined)
        : undefined;
    const errors = draft ? validateEntity(spec, draft).filter((i) => i.severity === 'error') : [];
    const duplicate = !!draft && currentById.has(String(draft[idKey]));
    const draftReady = !!draft && hasDraftIdentity(spec, draft);
    useEffect(() => {
        setFormSession((session) => selectEntityFormSession(session, selected));
    }, [selected]);
    useEffect(() => {
        const element = layout.current;
        if (!element) return;
        const onWheel = (event: WheelEvent) => navigateCollectionOnWheel(event);
        element.addEventListener('wheel', onWheel, { passive: false });
        return () => element.removeEventListener('wheel', onWheel);
    });
    const abilities = previewCollections(source).abilities;
    const hasContext = !!context || abilities.length > 0;
    const rows = indexedRows.sort((a, b) =>
        String(
            lookup(Number(a.item[idKey]), manifestTable(a.item))?.name ?? a.item.Name,
        ).localeCompare(
            String(lookup(Number(b.item[idKey]), manifestTable(b.item))?.name ?? b.item.Name),
        ),
    );
    function selectItem(key: string | null) {
        setFormSession((session) => selectEntityFormSession(session, key));
        onSelect(key);
    }
    function navigateItem(key: string | null, mode: NavigationMode) {
        setFormSession((session) => selectEntityFormSession(session, key));
        onNavigate(key, mode);
    }
    function openMember(targetCollection: string, key: string) {
        if (targetCollection === collection) navigateItem(key, 'click');
        else onOpenMember(targetCollection, key);
    }
    function navigateCollectionOnWheel(event: WheelEvent) {
        if (!event.altKey || !event.shiftKey || event.deltaY === 0) return;
        const target = event.target;
        if (target instanceof Element && target.closest('.context-slot, dialog, [role="dialog"]'))
            return;

        event.preventDefault();
        const height = Math.max(layout.current?.clientHeight ?? 0, 1);
        const delta = normalizeWheelDeltaY(event.deltaY, event.deltaMode, height);
        const direction = consumeWheelNavigation(wheelNavigation.current, delta, Date.now());
        if (direction === undefined) return;

        const buttons = Array.from(
            layout.current?.querySelectorAll<HTMLButtonElement>(
                '.item-rows > .draft-row, .item-rows .row-select',
            ) ?? [],
        ).filter((button) => !button.disabled && button.getClientRects().length > 0);
        if (!buttons.length) return;
        const visibleKeys = buttons.flatMap((button) =>
            button.dataset.itemKey === undefined ? [] : [button.dataset.itemKey],
        );
        const selectedKey =
            buttons.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset
                .itemKey ?? null;
        const key = nextCollectionSelection(visibleKeys, selectedKey, direction);
        if (key !== undefined) navigateItem(key, 'scroll');
    }
    function selectGroup(memberIds: string[]) {
        setFormSession((session) => selectEntityFormSession(session, null));
        onNavigateGroup([...memberIds].sort());
    }
    function followIdentity(key: string) {
        setFormSession((session) => followEntityIdentity(session, key));
        onSelect(key);
    }
    function setDraft(value?: Record<string, unknown>) {
        dispatch(
            value
                ? { type: 'item-draft', key: draftKey, value }
                : { type: 'item-draft', key: draftKey },
        );
    }
    function add(copy?: Record<string, unknown>) {
        if (draft) {
            navigateItem('draft', 'click');
            return;
        }
        setDraft(createItemDraft(spec, items, copy));
        navigateItem('draft', 'click');
        setSearch('');
    }
    function actions(item: Record<string, unknown>, isDeleted: boolean): ItemAction[] {
        const id = String(item[idKey]),
            old = savedById.get(id);
        return isDeleted
            ? [
                  {
                      label: 'Restore item',
                      onSelect: () => {
                          onChange([...items, structuredClone(item)]);
                          selectItem(id);
                      },
                  },
              ]
            : [
                  { label: 'Duplicate', onSelect: () => add(item) },
                  {
                      label: 'Revert changes',
                      disabled: !!old && equal(old, item),
                      onSelect: () => {
                          onChange(
                              old
                                  ? items.map((i) =>
                                        String(i[idKey]) === id ? structuredClone(old) : i,
                                    )
                                  : items.filter((i) => String(i[idKey]) !== id),
                          );
                          if (!old) selectItem(null);
                      },
                  },
                  {
                      label: 'Delete',
                      danger: true,
                      onSelect: () => {
                          onChange(items.filter((i) => String(i[idKey]) !== id));
                          selectItem(old ? id : null);
                      },
                  },
              ];
    }
    function addDraftToList() {
        if (!draft || !draftReady || errors.length > 0 || duplicate) return;
        const next = [...items, draft].sort((a, b) => String(a.Name).localeCompare(String(b.Name)));
        onChange(next);
        navigateItem(String(draft[idKey]), 'click');
        setDraft();
    }
    function changeValue(next: Record<string, unknown>) {
        if (selected === 'draft') setDraft(next);
        else {
            onChange(items.map((item) => (item === current ? next : item)));
            if (String(next[idKey]) !== selected) followIdentity(String(next[idKey]));
        }
    }
    function useManifestName() {
        if (!editorValue || !manifest) return;
        const next = { ...editorValue, Name: manifest.name };
        if (selected === 'draft') setDraft(next);
        else onChange(items.map((item) => (item === current ? next : item)));
    }
    return (
        <div
            ref={layout}
            className={`entity-layout ${stat === 'Movement' ? 'movement-preview-layout ' : ''}${contextOpen ? 'context-open ' : ''}${selected !== null || editingGroup ? 'detail-open ' : ''}${hasContext ? '' : 'without-context'}`}
        >
            <EntityRows
                collection={collection}
                entityName={spec.name}
                idKey={idKey}
                rows={rows}
                draft={draft}
                selected={selected}
                search={search}
                groupByCooldown={spec.role === 'ability' || spec.role === 'superAbility'}
                editingGroup={editingGroup}
                getManifestName={(itemHash, item) => lookup(itemHash, manifestTable(item))?.name}
                getManifestTable={manifestTable}
                actions={actions}
                onSearch={setSearch}
                onSelect={selectItem}
                onNavigate={(key) => navigateItem(key, 'click')}
                onEditGroup={selectGroup}
                onAdd={() => add()}
                onAddFromManifest={() => setPicker(true)}
            />
            {editingGroup &&
            editingMembers.length === editingGroup.length &&
            editingMembers.length > 1 ? (
                <AbilityGroupEditor
                    spec={spec}
                    items={items}
                    members={editingMembers}
                    memberIds={editingGroup}
                    idKey={idKey}
                    collection={collection}
                    file={file}
                    savedById={savedById}
                    getManifestName={(memberHash, member) =>
                        lookup(memberHash, manifestTable(member))?.name
                    }
                    hasContext={hasContext}
                    contextOpen={contextOpen}
                    onToggleContext={() => setContextOpen(!contextOpen)}
                    onBack={() => navigateItem(null, 'click')}
                    onOpenMember={(member) => openMember(collection, String(member[idKey]))}
                    onChange={onChange}
                />
            ) : (
                <ItemEditorPane
                    spec={spec}
                    stat={stat}
                    statSpec={statSpec}
                    source={source}
                    collection={collection}
                    file={file}
                    selected={selected}
                    editorValue={editorValue}
                    saved={selected === 'draft' ? (editorValue ?? {}) : (original ?? {})}
                    abilities={abilities}
                    hash={hash}
                    manifestName={manifest?.name}
                    manifestTable={editorValue ? manifestTable(editorValue) : undefined}
                    deleted={deleted}
                    isDraft={selected === 'draft'}
                    formKey={formSession.token}
                    hasContext={hasContext}
                    contextOpen={contextOpen}
                    errors={errors.length}
                    duplicate={duplicate}
                    draftReady={draftReady}
                    actions={
                        editorValue && selected !== 'draft' ? actions(editorValue, deleted) : []
                    }
                    onToggleContext={() => setContextOpen(!contextOpen)}
                    onBack={() => navigateItem(null, 'click')}
                    onAddDraft={addDraftToList}
                    onDiscardDraft={() => {
                        setDraft();
                        selectItem(null);
                    }}
                    onRestoreDeleted={() => {
                        if (editorValue) onChange([...items, structuredClone(editorValue)]);
                    }}
                    onUseManifestName={useManifestName}
                    onChange={changeValue}
                />
            )}
            {hasContext && (
                <div
                    className={`context-slot${contextGroupMembers !== undefined ? ' context-slot-with-group' : ''}`}
                >
                    <button
                        className="context-close icon-button"
                        aria-label="Close context"
                        onClick={() => setContextOpen(false)}
                    >
                        ×
                    </button>
                    {context ?? (
                        <ContextPanel
                            source={source}
                            collection={collection}
                            selected={current}
                            groupMembers={contextGroupMembers}
                            onOpenMember={(memberCollection, member) =>
                                openMember(memberCollection, String(member.Hash))
                            }
                        />
                    )}
                </div>
            )}
            {picker && (
                <ManifestPicker
                    title={`Add ${spec.name} from manifest`}
                    chooseTable={spec.fields.some((field) => field.key === 'RefType')}
                    filter={collectionFilter(stat, collection)}
                    onClose={() => setPicker(false)}
                    onCreateBlank={() => {
                        setPicker(false);
                        add();
                    }}
                    onPick={(entry) => {
                        const next = {
                            ...createItemDraft(spec, items),
                            [idKey]: entry.hash,
                            Name: entry.name,
                            ...(spec.fields.some((field) => field.key === 'RefType')
                                ? {
                                      RefType:
                                          entry.table === 'itemCategory' ? 'itemCategory' : 'item',
                                  }
                                : {}),
                        };
                        setDraft(next);
                        navigateItem('draft', 'click');
                        setSearch('');
                        setPicker(false);
                    }}
                />
            )}
        </div>
    );
}
