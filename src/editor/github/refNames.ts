/** Why `name` is not a valid new branch name (git check-ref-format rules), or undefined. */
export function branchNameProblem(name: string): string | undefined {
    if (!name) return 'Enter a branch name.';
    if (/\s/.test(name)) return 'A branch name cannot contain spaces.';
    if (/[\u0000-\u001f\u007f]/.test(name))
        return 'A branch name cannot contain control characters.';
    const forbidden = /[~^:?*[\\]/.exec(name);
    if (forbidden) return `A branch name cannot contain "${forbidden[0]}".`;
    if (name.startsWith('-')) return 'A branch name cannot start with "-".';
    if (name.startsWith('/') || name.endsWith('/') || name.includes('//'))
        return 'A branch name cannot start or end with "/" or contain "//".';
    if (name.includes('..')) return 'A branch name cannot contain "..".';
    if (name.includes('@{') || name === '@') return 'A branch name cannot contain "@{" or be "@".';
    if (name === 'HEAD') return 'A branch cannot be named "HEAD".';
    if (name.endsWith('.')) return 'A branch name cannot end with ".".';
    const part = name
        .split('/')
        .find((segment) => segment.startsWith('.') || segment.endsWith('.lock'));
    if (part !== undefined) return 'A branch name part cannot start with "." or end with ".lock".';
    return undefined;
}

const two = (value: number) => String(value).padStart(2, '0');

/** `editor/update-YYYYMMDD-HHMM` in local time, suffixed `-2`, `-3`... if already taken. */
export function defaultBranchName(now: Date, taken: readonly string[] = []): string {
    const stamp = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}`;
    const base = `editor/update-${stamp}`;
    let name = base;
    for (let index = 2; taken.includes(name); index++) name = `${base}-${index}`;
    return name;
}
