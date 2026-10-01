import { buildParserContext } from './parser-context';
import { matchParserRule } from './parser-rules';

type ParsedResult =
  | {
      ok: true;
      templateKey: string;
      params: Record<string, unknown>;
      title: string;
      confidence: number;
    }
  | { ok: false; message: string; confidence: number };

export function parsePromptToTemplate(promptText: string): ParsedResult {
  const text = (promptText ?? '').trim();
  if (!text) return { ok: false, message: 'Unesi opis izveštaja.', confidence: 0 };

  const ctx = buildParserContext(text);
  const matched = matchParserRule(ctx);
  if (matched) {
    return {
      ok: true,
      templateKey: matched.templateKey,
      params: matched.params,
      title: matched.title,
      confidence: matched.confidence,
    };
  }

  return {
    ok: false,
    message:
      'Ne mogu da prepoznam tip izveštaja. Pokušaj sa primerima ispod: evidencija rada, tiketi, licence, odsustva, kompanije…',
    confidence: 0.2,
  };
}
