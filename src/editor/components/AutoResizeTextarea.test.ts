import { describe, expect, it } from 'vitest';
import { resizeTextarea } from './AutoResizeTextarea';

describe('auto-resize textarea sizing', () => {
    it('fits initial and edited content and shrinks when content shrinks', () => {
        let scrollHeight = 124;
        const textarea = {
            style: { height: '56px' },
            get scrollHeight() {
                return scrollHeight;
            },
            offsetHeight: 60,
            clientHeight: 58,
        };

        resizeTextarea(textarea);
        expect(textarea.style.height).toBe('126px');

        scrollHeight = 88;
        resizeTextarea(textarea);
        expect(textarea.style.height).toBe('90px');
    });
});
