/**
 * Structural masking for TypeScript source: replaces comments, string and
 * template literals, and regex literals with spaces (newlines kept), so
 * line/column offsets survive while lightweight scanners (the `Attrs` key
 * extractor, the `icon()` declaration scanner) only see code structure.
 * Internal to `@wavex/core`.
 */
export function maskTypeScriptNonCode(source: string): string {
  const output = source.split("");
  const maskRange = (start: number, end: number) => {
    for (let index = start; index < end; index += 1) {
      if (output[index] !== "\n") output[index] = " ";
    }
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    const next = source[index + 1];

    if (char === "/" && next === "/") {
      const start = index;
      index += 2;
      while (index < source.length && source[index] !== "\n") index += 1;
      maskRange(start, index);
      continue;
    }

    if (char === "/" && next === "*") {
      const start = index;
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
      index = Math.min(source.length, index + 2);
      maskRange(start, index);
      index -= 1;
      continue;
    }

    if (char === "/" && canStartRegexLiteral(source, index)) {
      const start = index;
      index += 1;
      let inCharacterClass = false;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source[index] === "[") inCharacterClass = true;
        else if (source[index] === "]") inCharacterClass = false;
        else if (source[index] === "/" && !inCharacterClass) {
          index += 1;
          while (/[$A-Za-z]/.test(source[index] ?? "")) index += 1;
          break;
        }
        index += 1;
      }
      maskRange(start, index);
      index -= 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      const start = index;
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source[index] === quote) {
          index += 1;
          break;
        }
        index += 1;
      }
      maskRange(start, index);
      index -= 1;
    }
  }

  return output.join("");
}

function canStartRegexLiteral(source: string, slashIndex: number): boolean {
  let index = slashIndex - 1;
  while (index >= 0 && /\s/.test(source[index]!)) index -= 1;
  if (index < 0) return true;

  const previous = source[index]!;
  if (/[=(:,[!&|?{};~*%^<>+-]/.test(previous)) return true;
  if (previous === ")") return followsControlFlowCondition(source, index);
  if (!/[A-Za-z_$]/.test(previous)) return false;

  let wordStart = index;
  while (wordStart > 0 && /[\w$]/.test(source[wordStart - 1]!)) wordStart -= 1;
  return /^(return|throw|case|delete|void|typeof|yield|await|in|of|else|do)$/.test(source.slice(wordStart, index + 1));
}

function followsControlFlowCondition(source: string, closeParenIndex: number): boolean {
  let depth = 1;
  let index = closeParenIndex - 1;
  while (index >= 0) {
    const char = source[index]!;
    if (char === '"' || char === "'" || char === "`") {
      index = previousStringDelimiter(source, index, char);
    } else if (char === ")") depth += 1;
    else if (char === "(") {
      depth -= 1;
      if (depth === 0) break;
    }
    index -= 1;
  }
  if (index < 0) return false;

  index -= 1;
  while (index >= 0 && /\s/.test(source[index]!)) index -= 1;
  let wordStart = index;
  while (wordStart > 0 && /[\w$]/.test(source[wordStart - 1]!)) wordStart -= 1;
  return /^(if|while|for|with)$/.test(source.slice(wordStart, index + 1));
}

function previousStringDelimiter(source: string, closeIndex: number, quote: string): number {
  for (let index = closeIndex - 1; index >= 0; index -= 1) {
    if (source[index] !== quote) continue;
    let backslashes = 0;
    for (let escapeIndex = index - 1; escapeIndex >= 0 && source[escapeIndex] === "\\"; escapeIndex -= 1) {
      backslashes += 1;
    }
    if (backslashes % 2 === 0) return index;
  }
  return closeIndex;
}
