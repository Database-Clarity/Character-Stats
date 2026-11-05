import { useEffect, useState } from 'react';
import { useManifest } from './context';
import type { ManifestTable } from './types';
import { isPrismaticAbility } from './prismatic';

export interface ManifestIconProps {
    hash: number;
    size?: number;
    className?: string;
    table?: ManifestTable;
    nativeTitle?: boolean;
    /** Hide from assistive tech when the name is shown next to the icon. */
    decorative?: boolean;
}

export function ManifestIcon({
    hash,
    size = 24,
    className,
    table,
    nativeTitle = true,
    decorative = false,
}: ManifestIconProps): React.JSX.Element {
    const { lookup, status } = useManifest();
    const entry = status.state === 'ready' ? lookup(hash, table) : undefined;
    const [failed, setFailed] = useState(false);

    useEffect(() => setFailed(false), [entry?.icon]);

    const style: React.CSSProperties = {
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        objectFit: 'cover',
        boxSizing: 'border-box',
    };
    const icon =
        !entry?.icon || failed ? (
            <span
                className={className}
                {...(decorative
                    ? { 'aria-hidden': true }
                    : {
                          role: 'img',
                          'aria-label': entry?.name ?? `Unknown manifest item ${hash}`,
                      })}
                style={{
                    ...style,
                    display: 'inline-block',
                    backgroundColor: '#e7e7e7',
                    border: '1px solid rgba(0, 0, 0, 0.14)',
                }}
            />
        ) : (
            <img
                className={className}
                src={entry.icon}
                alt={decorative ? '' : entry.name}
                width={size}
                height={size}
                loading="lazy"
                decoding="async"
                style={style}
                onError={() => setFailed(true)}
            />
        );
    return isPrismaticAbility(entry) ? (
        <span
            className="prismatic-icon"
            style={{ width: size, height: size }}
            {...(nativeTitle ? { title: 'Prismatic ability' } : {})}
        >
            {icon}
            <span className="prismatic-marker" aria-label="Prismatic ability" />
        </span>
    ) : (
        icon
    );
}
