import type { Token } from "./lexer.js";
export type { Token } from "./lexer.js";

export { CommandTrie, resolveCommand, extractPathCandidate } from "./router.js";
export type {
  CommandDescriptor,
  CommandEntry,
  ResolveResult,
} from "./router.js";

export function geass(handler: (args: any, c: any) => unknown) {
  // TODO
  return { handler };
}
