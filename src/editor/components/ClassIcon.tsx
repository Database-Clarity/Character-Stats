export function ClassIcon({ type, name, size }: { type: 0 | 1 | 2; name: string; size: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            role="img"
            aria-label={`${name} class`}
            className="class-symbol"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
        >
            {type === 0 ? (
                <>
                    <path d="M5 4h14v10l-7 6-7-6Z" />
                    <path d="M5 9h14M12 4v16" />
                </>
            ) : type === 1 ? (
                <>
                    <path d="m5 4 7 5 7-5M5 9l7 5 7-5M5 14l7 5 7-5" />
                </>
            ) : (
                <>
                    <path d="m12 3 4 9-4 9-4-9Z" />
                    <path d="m4 7 4 5-4 5M20 7l-4 5 4 5" />
                </>
            )}
        </svg>
    );
}
