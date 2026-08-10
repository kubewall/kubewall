import type * as Monaco from 'monaco-editor';

type MonacoApi = typeof Monaco;

// Monaco is a multi-MB dependency that the YAML editor already lazy-loads.
// Importing it dynamically here keeps ConfigMap data blocks out of the main
// bundle and shares that same async chunk when both are on screen.
let monacoApi: MonacoApi | null = null;
let pending: Promise<MonacoApi> | null = null;

const JSON_TOKENIZER_PROBE = '{"a":1}';
const TOKENIZER_POLL_INTERVAL_MS = 25;
const TOKENIZER_POLL_ATTEMPTS = 40;

const delay = (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const hasTokenizer = (monaco: MonacoApi, languageId: string, probe: string) =>
  monaco.editor.tokenize(probe, languageId)[0]?.some(({ type }) => type !== '') ?? false;

/**
 * Unlike the Monarch grammars, monaco's JSON tokenizer is only installed once
 * the language is first requested - which happens when a model of that language
 * is created. Without this warm-up the first colorize(..., 'json') silently
 * falls back to unhighlighted output, since the tokenizer lands a tick later.
 */
const warmUpJson = async (monaco: MonacoApi) => {
  monaco.editor.createModel('', 'json').dispose();
  for (let attempt = 0; attempt < TOKENIZER_POLL_ATTEMPTS; attempt++) {
    if (hasTokenizer(monaco, 'json', JSON_TOKENIZER_PROBE)) {
      return;
    }
    await delay(TOKENIZER_POLL_INTERVAL_MS);
  }
};

const loadMonaco = (): Promise<MonacoApi> => {
  if (!pending) {
    pending = import('monaco-editor').then(async (monaco) => {
      await warmUpJson(monaco);
      monacoApi = monaco;
      return monaco;
    });
  }
  return pending;
};

const EXTENSION_LANGUAGES: Record<string, string> = {
  bash: 'shell',
  cfg: 'ini',
  cnf: 'ini',
  conf: 'ini',
  env: 'ini',
  htm: 'html',
  html: 'html',
  ini: 'ini',
  js: 'javascript',
  json: 'json',
  lua: 'lua',
  md: 'markdown',
  properties: 'ini',
  py: 'python',
  sh: 'shell',
  sql: 'sql',
  toml: 'ini',
  ts: 'typescript',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'shell'
};

const isJson = (value: string) => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * ConfigMap keys are filenames often enough that the extension is the most
 * reliable signal; keys like "setup" or "teardown" carry none, so the content
 * is sniffed instead. Returns null when nothing matches - better to render a
 * value plain than to colour it as the wrong language.
 */
const detectLanguage = (value: string, fileName?: string): string | null => {
  const name = fileName?.toLowerCase() ?? '';
  const extension = name.includes('.') ? name.split('.').pop() : undefined;

  if (extension && EXTENSION_LANGUAGES[extension]) {
    return EXTENSION_LANGUAGES[extension];
  }
  if (name === 'dockerfile' || name.startsWith('dockerfile.')) {
    return 'dockerfile';
  }

  const trimmed = value.trim();
  if (/^#!.*\b(ba|z|k|da)?sh\b/.test(trimmed)) {
    return 'shell';
  }
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && isJson(trimmed)) {
    return 'json';
  }
  if (trimmed.startsWith('<')) {
    return 'xml';
  }
  if (/^---\s*$/m.test(trimmed) || /^\s*[\w.\-/]+:(\s|$)/m.test(trimmed)) {
    return 'yaml';
  }
  if (/^\s*\[[^\]\n]+\]\s*$/m.test(trimmed) || /^\s*[\w.-]+\s*=/m.test(trimmed)) {
    return 'ini';
  }
  return null;
};

/**
 * Colourises `value` with monaco's tokenizer and returns one HTML string per
 * line, or null when the language is unknown - callers then render raw text.
 * Only the tokenizer is used here, not an editor instance, so a ConfigMap with
 * many keys stays cheap.
 */
const colorizeLines = async (value: string, theme: string, fileName?: string): Promise<string[] | null> => {
  const language = detectLanguage(value, fileName);
  if (!language) {
    return null;
  }

  const monaco = monacoApi ?? await loadMonaco();
  // The generated `.mtkN` colour rules are global and belong to whichever theme
  // was last set, so the app theme has to be applied before markup is produced.
  monaco.editor.setTheme(theme);
  const html = await monaco.editor.colorize(value, language, { tabSize: 2 });

  // colorize() joins lines with <br/> and appends a trailing one. Its per-line
  // markup is self-contained and escapes the source text, so splitting here is
  // safe and each line renders as valid HTML on its own.
  const lines = html.split('<br/>');
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
};

export {
  colorizeLines,
  detectLanguage,
  loadMonaco
};
