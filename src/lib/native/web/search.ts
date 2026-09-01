import type { WebCommandHandler } from "./index";

/**
 * Browser port of `helpers/search.rs` — the fuzzy matcher. No frontend code
 * calls `native.search.*` today (TBA import uses a plain substring filter), but
 * the surface is kept complete and faithful: strings are already UTF-16, which
 * is exactly what the Rust `encode_utf16()` path operates on, so scores and
 * matched indices are identical.
 */
const EXACT = 100;
const STARTS_WITH = 50;
const WORD_BOUNDARY = 30;
const CONSECUTIVE_BONUS = 15;
const CAMEL_CASE = 20;
const CHAR_MATCH = 10;
const GAP_PENALTY = -3;
const FIRST_CHAR_BONUS = 15;
const NAME_FIELD_BONUS = 20;

export interface MatchResult {
  score: number;
  matchedIndices: number[];
}
interface BatchItem {
  name: string;
  nameLower: string;
  details: string;
  detailsLower: string;
  key: string;
  keyLower: string;
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const rangeFrom = (start: number, end: number): number[] =>
  Array.from({ length: end - start }, (_, i) => start + i);

const WORD_BOUNDARY_CODES = new Set([0x20, 0x2d, 0x5f, 0x2e, 0x2c, 0x28, 0x29, 0x2f, 0x5c]);

function isWordBoundary(units: string, index: number): boolean {
  return index === 0 || WORD_BOUNDARY_CODES.has(units.charCodeAt(index - 1));
}
function isCamelCaseBoundary(original: string, index: number): boolean {
  if (index === 0 || index >= original.length) return false;
  const ch = original.charCodeAt(index);
  const prev = original.charCodeAt(index - 1);
  return ch >= 0x41 && ch <= 0x5a && prev >= 0x61 && prev <= 0x7a;
}

function calculateFuzzyScore(search: string, target: string, original: string): MatchResult | null {
  if (search.length > target.length) return null;

  const matched: number[] = [];
  let searchIdx = 0;
  for (let i = 0; i < target.length && searchIdx < search.length; i += 1) {
    if (target.charCodeAt(i) === search.charCodeAt(searchIdx)) {
      matched.push(i);
      searchIdx += 1;
    }
  }
  if (searchIdx !== search.length) return null;

  let score = 0;
  let consecutive = 0;
  let prev = -2;
  for (let i = 0; i < matched.length; i += 1) {
    const matchIdx = matched[i];
    score += CHAR_MATCH;
    if (i === 0 && matchIdx === 0) score += FIRST_CHAR_BONUS;
    if (isWordBoundary(target, matchIdx)) score += WORD_BOUNDARY;
    if (isCamelCaseBoundary(original, matchIdx)) score += CAMEL_CASE;
    if (matchIdx === prev + 1) {
      consecutive += 1;
      score += CONSECUTIVE_BONUS * consecutive;
    } else {
      consecutive = 0;
      if (i > 0) score += GAP_PENALTY * Math.min(matchIdx - prev - 1, 5);
    }
    prev = matchIdx;
  }
  score += Math.max(0, 20 - (target.length - search.length));
  return { score, matchedIndices: matched };
}

export function fuzzyMatch(
  searchTerm: string,
  target: string,
  originalTarget?: string,
): MatchResult | null {
  if (searchTerm === "") return { score: 0, matchedIndices: [] };
  if (target === "") return null;
  const original = originalTarget ?? target;

  if (target === searchTerm) {
    return { score: EXACT + searchTerm.length * CHAR_MATCH, matchedIndices: range(searchTerm.length) };
  }

  const exactIndex = target.indexOf(searchTerm);
  if (exactIndex !== -1) {
    const len = searchTerm.length;
    let score = CHAR_MATCH * len + CONSECUTIVE_BONUS * (len - 1);
    if (exactIndex === 0) score += STARTS_WITH;
    if (exactIndex === 0 || isWordBoundary(target, exactIndex)) score += WORD_BOUNDARY;
    return { score, matchedIndices: rangeFrom(exactIndex, exactIndex + len) };
  }

  return calculateFuzzyScore(searchTerm, target, original);
}

interface BatchMatch {
  index: number;
  score: number;
  matchedIndices: number[];
}

export function fuzzySearchBatch(
  items: BatchItem[],
  searchLower: string,
  minScore: number,
): BatchMatch[] {
  const matches: BatchMatch[] = [];
  items.forEach((item, index) => {
    const nameMatch = fuzzyMatch(searchLower, item.nameLower, item.name);
    const detailsMatch = fuzzyMatch(searchLower, item.detailsLower, item.details);
    const keyMatch = fuzzyMatch(searchLower, item.keyLower, item.key);

    let best: MatchResult | null = null;
    if (nameMatch) {
      best = { score: nameMatch.score + NAME_FIELD_BONUS, matchedIndices: nameMatch.matchedIndices };
    }
    if (detailsMatch && (best === null || detailsMatch.score > best.score)) best = detailsMatch;
    if (keyMatch && (best === null || keyMatch.score > best.score)) best = keyMatch;

    if (best && best.score >= minScore) {
      matches.push({ index, score: best.score, matchedIndices: best.matchedIndices });
    }
  });
  matches.sort((a, b) => b.score - a.score); // stable, matching Rust's stable sort_by_key
  return matches;
}

export const searchCommands: Record<string, WebCommandHandler> = {
  fuzzy_match: (args) =>
    fuzzyMatch(String(args.searchTerm ?? ""), String(args.target ?? ""), args.originalTarget as string | undefined),
  fuzzy_search_batch: (args) =>
    fuzzySearchBatch(
      (args.items as BatchItem[]) ?? [],
      String(args.searchLower ?? ""),
      typeof args.minScore === "number" ? args.minScore : 0,
    ),
};
