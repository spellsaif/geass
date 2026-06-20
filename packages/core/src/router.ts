import type { Token } from "./lexer.js";

/**
 * What the Trie stores at each resolved path — metadata only, not the
 * command's actual code. The handler module is import()-ed
 * only when its path is resolved, never eagerly. `load` is how that
 * deferral is expressed: resolving a command never calls it.
 */
export interface CommandDescriptor {
  name: string;
  description?: string;
}

export interface CommandEntry<TModule = unknown> {
  descriptor: CommandDescriptor;
  load: () => Promise<TModule>;
}

export interface ResolveResult<TModule> {
  command: CommandEntry<TModule>;
  // how many leading path segments this match consumed
  consumed: number;
}

class TrieNode<TModule> {
  children = new Map<string, TrieNode<TModule>>();
  command?: CommandEntry<TModule>;
}

export class CommandTrie<TModule = unknown> {
  private root = new TrieNode<TModule>();

  insert(path: string[], entry: CommandEntry<TModule>): void {
    if (path.length === 0) {
      throw new Error("Command path must have at least one segment");
    }

    let node = this.root;
    for (const segment of path) {
      let child = node.children.get(segment);
      if (!child) {
        child = new TrieNode<TModule>();
        node.children.set(segment, child);
      }
      node = child;
    }

    if (node.command) {
      throw new Error(
        `Duplicate command registered at path: ${path.join(" ")}`,
      );
    }
    node.command = entry;
  }

  /**
   * Longest-match-wins `watch anime foo` resolves to
   * "deploy rollback", treating "foo" as a positional argument —
   * never as part of the command path itself.
   */
  resolve(path: string[]): ResolveResult<TModule> | null {
    let node: TrieNode<TModule> = this.root;
    let lastMatch: ResolveResult<TModule> | null = null;

    for (let i = 0; i < path.length; i++) {
      const child = node.children.get(path[i]);
      if (!child) break;
      node = child;
      if (node.command) {
        lastMatch = { command: node.command, consumed: i + 1 };
      }
    }

    return lastMatch;
  }
}

/**
 * The Token[] → string[] adapter. Pulls out the leading contiguous run
 * of positional tokens as the command-path candidate — flags and
 * doubledash always end the run, since a command path is always a
 * prefix of bare words.
 */
export function extractPathCandidate(tokens: Token[]): string[] {
  const path: string[] = [];
  for (const tok of tokens) {
    if (tok.kind !== "positional") break;
    path.push(tok.value);
  }
  return path;
}

/**
 * Resolves a command from a token stream and returns the leftover
 * tokens (flags + any positionals past the matched path) for the
 * Schema Loader and Parser stages to consume next.
 */
export function resolveCommand<TModule>(
  tokens: Token[],
  trie: CommandTrie<TModule>,
): { result: ResolveResult<TModule>; rest: Token[] } | null {
  const candidate = extractPathCandidate(tokens);
  const result = trie.resolve(candidate);
  if (!result) return null;
  return { result, rest: tokens.slice(result.consumed) };
}
