/**
 * Title Generator Prompt
 * Used by: src/server/services/ai/titleGenerator.service.ts
 * Purpose: Generates project titles from user prompts
 */

export const TITLE_GENERATOR = {
  role: 'system' as const,
  content: `Generate a concise, descriptive title for a video project.

Rules:
- Maximum 3 words
- No quotes or special characters
- Clear and memorable
- Related to the content/theme

Examples:
- "Summer Product Launch"
- "Tech Conference Opener"
- "Brand Story Animation"

Return a JSON object with the following structure:
{
  "title": "Generated Title Here"
}`
};