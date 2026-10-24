import { useState, type FormEvent } from 'react';
import { GitHubDataSource, LocalDevDataSource, type DataSource, type LoadedData } from '../data';
import { GitHubClient } from '../github/client';
import logo from '../assets/clarity-logo.svg';
export interface LoginSettings {
    token: string;
    owner: string;
    name: string;
    branch: string;
    remember: boolean;
}
const storageKey = 'character-stats-editor-login';
function savedSettings(): LoginSettings {
    const defaults: LoginSettings = {
        token: '',
        owner: 'Database-Clarity',
        name: 'Character-Stats',
        branch: 'master',
        remember: false,
    };
    try {
        const saved = localStorage.getItem(storageKey) ?? sessionStorage.getItem(storageKey);
        if (!saved) return defaults;
        const parsed = JSON.parse(saved) as Partial<LoginSettings>;
        return {
            token: typeof parsed.token === 'string' ? parsed.token : '',
            owner: parsed.owner || defaults.owner,
            name: parsed.name || defaults.name,
            branch: parsed.branch || defaults.branch,
            remember: parsed.remember === true,
        };
    } catch {
        return defaults;
    }
}
export function forgetLogin() {
    try {
        localStorage.removeItem(storageKey);
        sessionStorage.removeItem(storageKey);
    } catch {
        /* Storage may be disabled in private browsing. */
    }
}
export function LoginScreen({ onLoad }: { onLoad(source: DataSource, loaded: LoadedData): void }) {
    const [settings, setSettings] = useState(savedSettings);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    function change<K extends keyof LoginSettings>(key: K, value: LoginSettings[K]) {
        setSettings((current) => ({ ...current, [key]: value }));
    }
    async function connect(local = false) {
        setBusy(true);
        setError('');
        try {
            const repo = {
                owner: settings.owner.trim(),
                name: settings.name.trim(),
                branch: settings.branch.trim(),
            };
            const source = local
                ? new LocalDevDataSource()
                : new GitHubDataSource(new GitHubClient(settings.token.trim(), repo));
            const loaded = await source.load();
            // Fail at the login boundary rather than crashing while rendering a malformed repository.
            for (const [path, text] of Object.entries(loaded.files)) {
                const value: unknown = JSON.parse(text);
                if (!value || typeof value !== 'object' || Array.isArray(value))
                    throw new Error(`${path}: expected a JSON object`);
            }
            if (!loaded.files['sources/movement.json'] || !loaded.files['locale/en.json'])
                throw new Error('Repository is missing sources/movement.json or locale/en.json.');
            if (!local) {
                forgetLogin();
                try {
                    (settings.remember ? localStorage : sessionStorage).setItem(
                        storageKey,
                        JSON.stringify({ ...settings, ...repo, token: settings.token.trim() }),
                    );
                } catch {
                    /* Connection still works when browser storage is unavailable. */
                }
            }
            onLoad(source, loaded);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    function submit(event: FormEvent) {
        event.preventDefault();
        void connect();
    }
    return (
        <main className="login">
            <div className="brand">
                <img src={logo} alt="Clarity" /> Clarity <span>data editor</span>
            </div>
            <h1>Connect to your repository</h1>
            <p className="muted">
                Edit source data, review your changes, then save a single commit.
            </p>
            <form onSubmit={submit}>
                <fieldset disabled={busy}>
                    <label>
                        Fine-grained GitHub personal access token
                        <input
                            required
                            type="password"
                            autoComplete="off"
                            value={settings.token}
                            onChange={(e) => change('token', e.target.value)}
                        />
                    </label>
                    <details open>
                        <summary>Required repository permissions</summary>
                        <ul>
                            <li>Contents: read and write</li>
                            <li>Pull requests: read and write</li>
                            <li>Actions: read and write</li>
                            <li>Metadata: read</li>
                        </ul>
                        <a
                            href="https://github.com/settings/personal-access-tokens/new"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Create a fine-grained token on GitHub
                        </a>
                    </details>
                    <div className="row">
                        <label>
                            Repository owner
                            <input
                                required
                                value={settings.owner}
                                onChange={(e) => change('owner', e.target.value)}
                            />
                        </label>
                        <label>
                            Repository name
                            <input
                                required
                                value={settings.name}
                                onChange={(e) => change('name', e.target.value)}
                            />
                        </label>
                    </div>
                    <label>
                        Branch
                        <input
                            required
                            value={settings.branch}
                            onChange={(e) => change('branch', e.target.value)}
                        />
                    </label>
                    <label className="check">
                        <input
                            type="checkbox"
                            checked={settings.remember}
                            onChange={(e) => change('remember', e.target.checked)}
                        />
                        Remember me on this device (localStorage)
                    </label>
                    <p className="help">
                        Tokens stay in this browser's sessionStorage by default and are sent only to
                        api.github.com. Remember me keeps the token in localStorage. Use a trusted
                        device and a repository-scoped token.
                    </p>
                    <button className="primary" disabled={!settings.token.trim()}>
                        {busy ? 'Loading data…' : 'Connect to GitHub'}
                    </button>
                </fieldset>
            </form>
            {import.meta.env.DEV && (
                <button className="local-button" disabled={busy} onClick={() => void connect(true)}>
                    Use local dev data
                </button>
            )}
            {error && (
                <p className="error" role="alert">
                    {error}
                </p>
            )}
        </main>
    );
}
