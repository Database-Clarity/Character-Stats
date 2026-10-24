import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ManifestStatus } from '../manifest';
import { HashIdentity, ManifestPicker, ManifestStatusBadge } from './ManifestUI';

const manifest = vi.hoisted(() => ({
    status: { state: 'disabled', reason: 'No API key' } as ManifestStatus,
}));
vi.mock('../manifest', async (original) => ({
    ...(await original<typeof import('../manifest')>()),
    useManifest: () => ({
        status: manifest.status,
        lookup: () => undefined,
        search: () => [],
        subclasses: () => [],
        refresh: () => {},
    }),
}));

function picker() {
    return renderToStaticMarkup(
        createElement(ManifestPicker, {
            title: 'Add',
            onPick: () => {},
            onClose: () => {},
            onCreateBlank: () => {},
            filter: () => true,
        }),
    );
}

describe('manifest availability and picker states', () => {
    it('shows hashes after names in compact identities and preserves full identity details', () => {
        const compact = renderToStaticMarkup(
            createElement(HashIdentity, { hash: 123456, name: 'Shared name', compact: true }),
        );
        expect(compact).toContain(
            '<span title="Shared name">Shared name</span><small class="mono muted identity-hash" title="123456">123456</small>',
        );

        const full = renderToStaticMarkup(
            createElement(HashIdentity, { hash: 123456, name: 'Shared name' }),
        );
        expect(full).toContain('class="mono muted identity-hash"');
        expect(full).toContain('123456');
    });
    it('shows the disabled reason without a retry button and offers a blank draft', () => {
        manifest.status = { state: 'disabled', reason: 'No API key' };
        const badge = renderToStaticMarkup(createElement(ManifestStatusBadge));
        expect(badge).toContain('No API key');
        expect(badge).not.toContain('<button');
        expect(picker()).toContain('Create blank draft');
        expect(picker()).not.toContain('No matching entries');
    });
    it('reserves retry for errors and distinguishes loading from no matches', () => {
        manifest.status = { state: 'error', error: 'Network unavailable' };
        expect(renderToStaticMarkup(createElement(ManifestStatusBadge))).toContain('retry');
        expect(picker()).toContain('Network unavailable');
        expect(picker()).toContain('Create blank draft');
        manifest.status = { state: 'loading', step: 'Downloading items' };
        expect(picker()).toContain('Manifest loading: Downloading items');
        expect(picker()).not.toContain('No matching entries');
    });
    it('uses one search box with suggested and other groups, without a search-all checkbox', () => {
        manifest.status = { state: 'ready', version: 'test' };
        const html = picker();
        expect(html.match(/type="search"/g)).toHaveLength(1);
        expect(html).toContain('Suggested');
        expect(html).toContain('Other matches');
        expect(html).toContain('No matching entries');
        expect(html).not.toContain('type="checkbox"');
    });
});
