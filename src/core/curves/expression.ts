export type ExpressionNode =
    | { type: 'number'; value: number }
    | { type: 'variable' }
    | { type: 'unary'; operand: ExpressionNode }
    | { type: 'binary'; operator: string; left: ExpressionNode; right: ExpressionNode }
    | { type: 'call'; name: string; args: ExpressionNode[] };

export class ExpressionError extends Error {
    constructor(
        message: string,
        public readonly position: number,
    ) {
        super(message + ' at column ' + (position + 1));
    }
}
interface ExpressionFunction {
    min: number;
    max: number;
    run: (...args: number[]) => number;
}

const expressionFunctions: Record<string, ExpressionFunction> = {
    min: { min: 1, max: Infinity, run: Math.min },
    max: { min: 1, max: Infinity, run: Math.max },
    abs: { min: 1, max: 1, run: Math.abs },
    floor: { min: 1, max: 1, run: Math.floor },
    ceil: { min: 1, max: 1, run: Math.ceil },
    round: { min: 1, max: 1, run: Math.round },
    sqrt: { min: 1, max: 1, run: Math.sqrt },
    log: { min: 1, max: 1, run: Math.log10 },
    ln: { min: 1, max: 1, run: Math.log },
    exp: { min: 1, max: 1, run: Math.exp },
    pow: { min: 2, max: 2, run: Math.pow },
    clamp: { min: 3, max: 3, run: (v, lo, hi) => Math.min(hi, Math.max(lo, v)) },
};

/** Parses the supported math language; syntax errors include a zero-based position. */
export function parseExpression(text: string): ExpressionNode {
    let position = 0;
    let depth = 0;

    const error = (message: string): never => {
        throw new ExpressionError(message, position);
    };

    const skipWhitespace = () => {
        while (/\s/.test(text[position] ?? '') && position < text.length) {
            position++;
        }
    };

    const consume = (token: string) => {
        skipWhitespace();
        if (text[position] === token) {
            position++;
            return true;
        }
        return false;
    };

    function withDepthLimit<T>(parse: () => T): T {
        if (++depth > 128) {
            error('Expression nesting limit exceeded');
        }
        try {
            return parse();
        } finally {
            depth--;
        }
    }

    function parsePrimary(): ExpressionNode {
        skipWhitespace();
        if (consume('(')) {
            const node = withDepthLimit(parseSum);
            if (!consume(')')) {
                error('Expected closing parenthesis');
            }
            return node;
        }
        const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(text.slice(position));
        if (number) {
            position += number[0].length;
            const value = Number(number[0]);
            if (!Number.isFinite(value)) {
                error('Number must be finite');
            }
            return { type: 'number', value };
        }
        const identifier = /^[A-Za-z_][A-Za-z_0-9]*/.exec(text.slice(position));
        if (!identifier) {
            return error('Expected number, x, or function');
        }
        const start = position;
        position += identifier[0].length;
        const name = identifier[0];
        if (name === 'x') {
            return { type: 'variable' };
        }
        if (name === 'pi' || name === 'e') {
            return { type: 'number', value: name === 'pi' ? Math.PI : Math.E };
        }
        const functionSpec = Object.hasOwn(expressionFunctions, name)
            ? expressionFunctions[name]
            : undefined;
        if (!functionSpec) {
            throw new ExpressionError('Unknown identifier ' + name, start);
        }
        if (!consume('(')) {
            error('Expected function arguments');
        }
        const args: ExpressionNode[] = [];
        if (!consume(')')) {
            do {
                args.push(withDepthLimit(parseSum));
            } while (consume(','));
            if (!consume(')')) {
                error('Expected closing parenthesis');
            }
        }
        if (args.length < functionSpec.min || args.length > functionSpec.max) {
            error('Invalid argument count for ' + name);
        }
        return { type: 'call', name, args };
    }

    function parsePower(): ExpressionNode {
        const left = parsePrimary();
        return consume('^')
            ? { type: 'binary', operator: '^', left, right: withDepthLimit(parseUnary) }
            : left;
    }

    function parseUnary(): ExpressionNode {
        if (consume('-')) {
            return { type: 'unary', operand: withDepthLimit(parseUnary) };
        }
        if (consume('+')) {
            return withDepthLimit(parseUnary);
        }
        return parsePower();
    }

    function parseProduct(): ExpressionNode {
        let left = parseUnary();
        while (true) {
            let op: string | undefined;
            if (consume('*')) {
                op = '*';
            } else if (consume('/')) {
                op = '/';
            }
            if (!op) {
                return left;
            }
            left = { type: 'binary', operator: op, left, right: parseUnary() };
        }
    }

    function parseSum(): ExpressionNode {
        let left = parseProduct();
        while (true) {
            let op: string | undefined;
            if (consume('+')) {
                op = '+';
            } else if (consume('-')) {
                op = '-';
            }
            if (!op) {
                return left;
            }
            left = { type: 'binary', operator: op, left, right: parseProduct() };
        }
    }

    if (text.length > 4096) {
        error('Expression length limit exceeded');
    }
    const result = parseSum();
    skipWhitespace();
    if (position !== text.length) {
        error('Unexpected token');
    }
    return result;
}

/** Evaluates a parsed or source expression, rejecting non-finite results. */
export function evaluateExpression(node: ExpressionNode | string, x: number): number {
    if (typeof node === 'string') {
        node = parseExpression(node);
    }

    function visit(current: ExpressionNode): number {
        switch (current.type) {
            case 'number':
                return current.value;
            case 'variable':
                return x;
            case 'unary':
                return -visit(current.operand);
            case 'call':
                return expressionFunctions[current.name]!.run(...current.args.map(visit));
            case 'binary': {
                const left = visit(current.left);
                const right = visit(current.right);
                switch (current.operator) {
                    case '+':
                        return left + right;
                    case '-':
                        return left - right;
                    case '*':
                        return left * right;
                    case '/':
                        return left / right;
                    case '^':
                        return left ** right;
                    default:
                        throw new Error('Unknown operator');
                }
            }
        }
    }

    const result = visit(node);
    if (!Number.isFinite(result)) {
        throw new Error('Expression produced a non-finite result at x=' + x);
    }
    return result;
}
