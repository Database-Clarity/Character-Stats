import { useState } from 'react';
import { isRecord, statRegistry } from '../../core';
import { useEditor } from '../state/store';
import { identityKey, type ChangeTarget } from '../state/editing';
import { movementViewSpec } from './StatView';
import { Modal } from './Modal';
export function QuickJump({
    onClose,
    onGo,
}: {
    onClose(): void;
    onGo(target: ChangeTarget): void;
}) {
    const { values } = useEditor(),
        [query, setQuery] = useState('');
    const options = [...statRegistry, movementViewSpec]
        .flatMap((spec) => {
            const file = Object.entries(values).find(([path, v]) =>
                spec.name === 'Movement'
                    ? path === 'sources/movement.json'
                    : isRecord(v) && v.Name === spec.name,
            )?.[1];
            return [
                {
                    stat: spec.name,
                    tab: 'Fields',
                    field: '',
                    label: `${spec.name} / ${spec.name === 'Movement' ? 'Rules' : 'Fields'}`,
                },
                { stat: spec.name, tab: 'Text', field: '', label: `${spec.name} / Text` },
                ...Object.entries(spec.collections).flatMap(([tab, entity]) => [
                    { stat: spec.name, tab, field: '', label: `${spec.name} / ${tab}` },
                    ...(isRecord(file) && Array.isArray(file[tab])
                        ? file[tab].filter(isRecord)
                        : []
                    ).map((item) => ({
                        stat: spec.name,
                        tab,
                        field: '',
                        itemKey: String(item[identityKey(entity)]),
                        label: `${spec.name} / ${tab} / ${item.Name} ${item[identityKey(entity)]}`,
                    })),
                ]),
            ];
        })
        .filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 80);
    return (
        <Modal title="Quick jump" onClose={onClose}>
            <label>
                Find a stat, tab, item or hash
                <input
                    autoFocus
                    type="search"
                    value={query}
                    placeholder="Type to navigate…"
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            e.currentTarget
                                .closest('dialog')
                                ?.querySelector<HTMLButtonElement>('.picker-results button')
                                ?.focus();
                        }
                        if (e.key === 'Enter' && options[0]) onGo(options[0]);
                    }}
                />
            </label>
            <div
                className="picker-results"
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        const buttons = Array.from(
                            e.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
                        );
                        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                        buttons[
                            (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
                                buttons.length
                        ]?.focus();
                    }
                }}
            >
                {options.map((option, i) => (
                    <button key={i} onClick={() => onGo(option)}>
                        {option.label}
                    </button>
                ))}
            </div>
            <p className="help">
                Ctrl+K to jump · / to filter collection · Alt+↑ / Alt+↓ to review changes
            </p>
        </Modal>
    );
}
