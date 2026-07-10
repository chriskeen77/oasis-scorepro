import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-4-8'

export function createClient(apiKey) {
  if (!apiKey) return null
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

const IDEAS_SCHEMA = {
  type: 'object',
  properties: {
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short evocative name, 2-6 words' },
          summary: {
            type: 'string',
            description: 'One or two sentences that sell the idea to the reader',
          },
        },
        required: ['title', 'summary'],
        additionalProperties: false,
      },
    },
  },
  required: ['options'],
  additionalProperties: false,
}

const IDEAS_SYSTEM = `You are the creative engine of StoryTime, a collaborative story-building app.
The user assembles a story ingredient by ingredient (genre, theme, location, characters, backstory, twist, details), and you brainstorm the options they choose from.

Rules for every brainstorm:
- Return exactly 6 distinct options.
- Span different moods and directions — no two options should feel interchangeable.
- Build on the ingredients the user has already chosen so every option fits the story taking shape.
- Titles are short and evocative (2-6 words). Summaries are one or two sentences that make the reader want to pick it.
- Be original: avoid clichés unless you can twist them into something fresh.`

function selectionLines(allSelections, steps) {
  const lines = []
  for (const step of steps) {
    const picks = allSelections[step.id]
    if (picks && picks.length > 0) {
      const rendered = picks
        .map((p) => (p.summary ? `${p.title} — ${p.summary}` : p.title))
        .join('; ')
      lines.push(`${step.label}: ${rendered}`)
    }
  }
  return lines
}

export async function generateIdeas(client, step, allSelections, steps) {
  const chosen = selectionLines(allSelections, steps)
  const context =
    chosen.length > 0
      ? `Ingredients chosen so far:\n${chosen.map((l) => `- ${l}`).join('\n')}`
      : 'Nothing has been chosen yet — this is the very first ingredient.'

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: IDEAS_SYSTEM,
    output_config: { format: { type: 'json_schema', schema: IDEAS_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `${context}\n\nNow brainstorm 6 options for the story's ${step.label.toLowerCase()}. ${step.guidance}`,
      },
    ],
  })

  const text = response.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('The model returned no ideas.')
  return JSON.parse(text).options
}

const STORY_SYSTEM = `You are StoryTime's storyteller — a masterful fiction writer with a warm, vivid voice.
You receive a set of story ingredients the reader hand-picked (and some they wrote themselves). Your job is to weave every ingredient into one seamless, satisfying story.

Craft guidelines:
- Honor every ingredient, especially anything the reader wrote in their own words — those matter most to them.
- Deploy the twist so it recontextualizes what came before; plant quiet setup for it early.
- Let the backstory surface naturally through the narrative rather than as an info-dump.
- Show, don't tell. Ground scenes in sensory detail. Give characters distinct voices.
- Begin your reply with the story's title on the first line (no markdown symbols, just the title), then a blank line, then the story told in flowing prose paragraphs.`

export function streamStory(client, allSelections, steps, length) {
  const lines = selectionLines(allSelections, steps)
  const prompt = `Here are the ingredients for my story:\n${lines
    .map((l) => `- ${l}`)
    .join(
      '\n',
    )}\n\nTarget length: about ${length.words} words.\n\nThink hard about how these pieces fit together — the structure, the emotional arc, where to plant the twist — then write the story.`

  return client.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: STORY_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })
}
