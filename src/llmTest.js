require("dotenv").config();
const { generateReply } = require("./llm");

(async () => {
  const text = await generateReply("Say hello in one short sentence.");
  console.log(text);
})();

