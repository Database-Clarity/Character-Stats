import titan from '../assets/class-titan.svg';
import hunter from '../assets/class-hunter.svg';
import warlock from '../assets/class-warlock.svg';

export function ClassIcon({ type, name, size }: { type: 0 | 1 | 2; name: string; size: number }) {
    return (
        <img
            src={[titan, hunter, warlock][type]}
            width={size}
            height={size}
            alt={`${name} class`}
            className="class-symbol"
        />
    );
}
