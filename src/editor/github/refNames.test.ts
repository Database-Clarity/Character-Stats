import { describe, expect, it } from 'vitest';
import { branchNameProblem, defaultBranchName } from './refNames';

describe('branchNameProblem', () => {
    it.each(['editor/update-20261030-1405', 'feature/x', 'a', 'v2.0-overhaul', 'a.b/c'])(
        'accepts %j',
        (name) => {
            expect(branchNameProblem(name)).toBeUndefined();
        },
    );

    it.each([
        '',
        'has space',
        'tab\there',
        'a..b',
        'a~b',
        'a^b',
        'a:b',
        'a?b',
        'a*b',
        'a[b',
        'a\\b',
        '-lead',
        '/lead',
        'trail/',
        'a//b',
        'x.lock',
        'dir/x.lock',
        'a/.hidden',
        '.hidden',
        'end.',
        '@',
        'HEAD',
        'a@{b',
        'ctrl\u0001char',
    ])('rejects %j with a message', (name) => {
        const problem = branchNameProblem(name);
        expect(problem).toEqual(expect.any(String));
        expect(problem).not.toBe('');
    });

    it('explains the common mistakes in plain words', () => {
        expect(branchNameProblem('')).toMatch(/enter a branch name/i);
        expect(branchNameProblem('has space')).toMatch(/spaces/);
    });
});

describe('defaultBranchName', () => {
    const base = 'editor/update-20261030-1405';
    const now = new Date(2026, 9, 30, 14, 5);

    it('stamps the local date and time', () => {
        expect(defaultBranchName(now)).toBe(base);
    });

    it('zero-pads month, day, hour and minute', () => {
        expect(defaultBranchName(new Date(2026, 0, 2, 3, 4))).toBe('editor/update-20260102-0304');
    });

    it('suffixes -2 when the stamped name is taken', () => {
        expect(defaultBranchName(now, [base])).toBe(`${base}-2`);
    });

    it('keeps counting past -2', () => {
        expect(defaultBranchName(now, [base, `${base}-2`])).toBe(`${base}-3`);
    });

    it('ignores unrelated taken names', () => {
        expect(defaultBranchName(now, ['editor/update-20261030-1406', 'feature/x'])).toBe(base);
    });
});
