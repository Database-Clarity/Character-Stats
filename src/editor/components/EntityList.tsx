import { useEffect, useState } from 'react';
import { isRecord, validateEntity, type EntitySpec, type StatSource } from '../../core';
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

export function EntityList({
    spec,
    items,
    file,
    collection,
    stat,
    source,
    selected,
    onSelect,
    onChange,
}: {
    spec: EntitySpec;
    items: Record<string, unknown>[];
    file: string;
    collection: string;
    stat: string;
    source: StatSource;
    selected: string | null;
    onSelect(key: string | null): void;
    onChange(next: Record<string, unknown>[]): void;
}) {
    const [formSession, setFormSession] = useState<EntityFormSession>(() => ({
        selected,
        baseline: selected,
        token: 0,
    }));
    const [search, setSearch] = useState(''),
        [picker, setPicker] = useState(false),
        [contextOpen, setContextOpen] = useState(false);
    const { originalValues, itemDrafts, dispatch } = useEditor();
    const { lookup } = useManifest();
    const idKey = identityKey(spec),
        draftKey = `${file}:${collection}`,
        draft = itemDrafts[draftKey];
    const originalFile = originalValues[file];
    const oldFile = isRecord(originalFile) ? originalFile : {};
    const saved = (Array.isArray(oldFile[collection]) ? oldFile[collection] : []).filter(isRecord);
    const { currentById, savedById, rows: indexedRows } = indexEntityRows(items, saved, idKey);
    const current = selected === 'draft' ? draft : selected ? currentById.get(selected) : undefined;
    const original =
        selected && selected !== 'draft'
            ? savedById.get(formSession.baseline ?? selected)
            : undefined;
    const deleted = !!original && !current;
    const editorValue = current ?? original;
    const identity = editorValue?.[idKey];
    const hash = typeof identity === 'number' && Number.isFinite(identity) ? identity : Number.NaN;
    const manifest = Number.isFinite(hash) ? lookup(hash) : undefined;
    const errors = draft ? validateEntity(spec, draft).filter((i) => i.severity === 'error') : [];
    const duplicate = !!draft && currentById.has(String(draft[idKey]));
    const draftReady = !!draft && hasDraftIdentity(spec, draft);
    useEffect(() => {
        setFormSession((session) => selectEntityFormSession(session, selected));
    }, [selected]);
    const abilities = previewCollections(source).abilities;
    const hasContext =
        isRecord(source.Fields) && !!source.Fields.CooldownScalars && abilities.length > 0;
    const rows = indexedRows.sort((a, b) =>
        String(lookup(Number(a.item[idKey]))?.name ?? a.item.Name).localeCompare(
            String(lookup(Number(b.item[idKey]))?.name ?? b.item.Name),
        ),
    );
    function selectItem(key: string | null) {
        setFormSession((session) => selectEntityFormSession(session, key));
        onSelect(key);
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
            selectItem('draft');
            return;
        }
        setDraft(createItemDraft(spec, items, copy));
        selectItem('draft');
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
        selectItem(String(draft[idKey]));
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
            className={`entity-layout ${contextOpen ? 'context-open' : ''} ${hasContext ? '' : 'without-context'}`}
        >
            <EntityRows
                collection={collection}
                entityName={spec.name}
                idKey={idKey}
                rows={rows}
                draft={draft}
                selected={selected}
                search={search}
                getManifestName={(itemHash) => lookup(itemHash)?.name}
                actions={actions}
                onSearch={setSearch}
                onSelect={selectItem}
                onAdd={() => add()}
                onAddFromManifest={() => setPicker(true)}
            />
            <ItemEditorPane
                spec={spec}
                collection={collection}
                file={file}
                selected={selected}
                editorValue={editorValue}
                saved={selected === 'draft' ? (editorValue ?? {}) : (original ?? {})}
                abilities={abilities}
                hash={hash}
                manifestName={manifest?.name}
                deleted={deleted}
                isDraft={selected === 'draft'}
                formKey={formSession.token}
                hasContext={hasContext}
                contextOpen={contextOpen}
                errors={errors.length}
                duplicate={duplicate}
                draftReady={draftReady}
                actions={editorValue && selected !== 'draft' ? actions(editorValue, deleted) : []}
                onToggleContext={() => setContextOpen(!contextOpen)}
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
            {hasContext && (
                <div className="context-slot">
                    <button
                        className="context-close icon-button"
                        aria-label="Close context"
                        onClick={() => setContextOpen(false)}
                    >
                        ×
                    </button>
                    <ContextPanel source={source} collection={collection} selected={current} />
                </div>
            )}
            {picker && (
                <ManifestPicker
                    title={`Add ${spec.name} from manifest`}
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
                        };
                        setDraft(next);
                        selectItem('draft');
                        setSearch('');
                        setPicker(false);
                    }}
                />
            )}
        </div>
    );
}
