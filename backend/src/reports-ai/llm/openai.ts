import { BadRequestException } from '@nestjs/common';

type OpenAiSqlResult = {
  title: string;
  sql: string;
};

export async function generateSqlFromPrompt(params: {
  apiKey: string;
  schemaSummary: string;
  promptText: string;
}): Promise<OpenAiSqlResult> {
  const { apiKey, schemaSummary, promptText } = params;
  const body = {
    model: 'gpt-4.1-mini',
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert data analyst. Generate ONE read-only PostgreSQL SELECT query.\n' +
          'Hard rules:\n' +
          '- Output must be valid JSON with keys: title, sql.\n' +
          '- SQL must be SELECT-only (SELECT or WITH ... SELECT). No semicolons.\n' +
          '- SQL MUST include tenant filter as: tenantId = {{tenantId}} on all relevant base tables.\n' +
          '- Always include LIMIT 1000 or smaller.\n' +
          '- Prefer simple joins; avoid cross joins.\n' +
          '- Use only the provided schema.\n',
      },
      {
        role: 'user',
        content:
          `Schema:\n${schemaSummary}\n\n` +
          `Question:\n${promptText}\n\n` +
          `Return JSON only.`,
      },
    ],
    response_format: { type: 'json_object' },
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new BadRequestException(`LLM error (${res.status}): ${text || 'request failed'}`);
  }
  const json = (await res.json()) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new BadRequestException('LLM returned empty response.');
  }
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new BadRequestException('LLM returned non-JSON response.');
  }
  const title = String(parsed?.title ?? '').trim();
  const sql = String(parsed?.sql ?? '').trim();
  if (!title || !sql) throw new BadRequestException('LLM returned invalid JSON payload.');
  return { title, sql };
}

