
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * Generate a single text response from the LLM
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function generateReply(prompt) {
  const response = await client.responses.create({
    model: MODEL,
    input: prompt,
  });

  return response.output_text;
}

module.exports = {
  generateReply,
};
