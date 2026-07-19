export function normalizePath(value) {
  return String(value || '').replaceAll('\\', '/').replace(/^\.\//, '');
}

function escapeChar(char) {
  return /[|\\{}()[\]^$+?.]/.test(char) ? `\\${char}` : char;
}

export function globToRegex(glob) {
  const value = normalizePath(glob);
  let source = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '*' && value[index + 1] === '*') {
      if (value[index + 2] === '/') {
        source += '(?:.*/)?';
        index += 2;
      } else {
        source += '.*';
        index += 1;
      }
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += escapeChar(char);
    }
  }
  return new RegExp(`^${source}$`, 'i');
}

export function matchesAny(filename, globs = []) {
  const normalized = normalizePath(filename);
  return globs.some((glob) => globToRegex(glob).test(normalized));
}
