/**
 * The lexer is intentionally dumb. It converts argv into a
 * flat token stream and does zero coercion, zero validation
 * and critically has no access to the schema. Anthing that
 * needs schema knowledge (is "-lol" three booleans or -l with
 * inline value "ol"? does  "-p" need value from the argv slot?)
 * is deferred to the parser.
 */

export type Token =
  | { kind: "long"; name: string; value?: string }
  | { kind: "short"; name: string; value?: string }
  | { kind: "positional"; value: string }
  | { kind: "doubledash" }
  | { kind: "passthrough"; value: string };

const DASH = 45; // '-'
const EQUALS = 61; // '='
const DOT = 46; // '.'
const ZERO = 48; // '0'
const NINE = 57; // '9'

export function lex(argv: string[]): Token[] {
  const tokens: Token[] = [];

  let passthrough = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (passthrough) {
      tokens.push({ kind: "passthrough", value: arg });
      continue;
    }

    if (arg === "--") {
      tokens.push({ kind: "doubledash" });
      passthrough = true;
      continue;
    }

    if (looksLikeNegativeNumber(arg)) {
      tokens.push({ kind: "positional", value: arg });
      continue;
    }

    if (
      arg.length >= 3 &&
      arg.charCodeAt(0) === DASH &&
      arg.charCodeAt(1) === DASH
    ) {
      tokens.push(lexLong(arg));
      continue;
    }

    if (arg.length >= 2 && arg.charCodeAt(0) === DASH) {
      tokens.push(lexShort(arg));
      continue;
    }

    tokens.push({ kind: "positional", value: arg });
  }

  return tokens;
}

function lexLong(arg: string): Token {
  for (let i = 2; i < arg.length; i++) {
    if (arg.charCodeAt(i) === EQUALS) {
      return { kind: "long", name: arg.slice(2, i), value: arg.slice(i + 1) };
    }
  }
  return { kind: "long", name: arg.slice(2) };
}

function lexShort(arg: string): Token {
  for (let i = 1; i < arg.length; i++) {
    if (arg.charCodeAt(i) === EQUALS) {
      return { kind: "short", name: arg.slice(1, i), value: arg.slice(i + 1) };
    }
  }
  // No "=" found — this could be "-p" alone, "-fav" as a cluster, or "-f"
  // with inline value "av". We can't tell without the schema, so we hand
  // the parser the raw, unsplit string and let *it* decide later.
  return { kind: "short", name: arg.slice(1) };
}

/**
 * "-7", "-7.77" should lex as a positional value, not a short flag.
 * Without this, `--retries -1` would tokenize "-1" as flag "1" — wrong.
 * We only need confidence on the unambiguous case: dash immediately
 * followed by a digit.
 */
function looksLikeNegativeNumber(arg: string): boolean {
  if (arg.length < 2 || arg.charCodeAt(0) !== DASH) return false;
  const firstDigit = arg.charCodeAt(1);
  if (firstDigit < ZERO || firstDigit > NINE) return false;

  let seenDot = false;
  for (let i = 2; i < arg.length; i++) {
    const code = arg.charCodeAt(i);
    if (code === DOT && !seenDot) {
      seenDot = true;
      continue;
    }
    if (code < ZERO || code > NINE) return false;
  }
  return true;
}
