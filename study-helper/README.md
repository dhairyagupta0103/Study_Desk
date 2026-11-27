# Study Desk private helper

This Cloudflare Worker keeps the OpenAI API key and Turnstile secret on the server. Neither secret belongs in `index.html`, `app.js`, `study-helper-config.js`, or any GitHub file.

The helper receives notes only after the student presses a submit button. Study Room sends notes and a question for an answer. Mind Games can send notes to make five puzzles. It has no web search or other tools. Answers and puzzles must include text checked against the submitted notes. The Worker does not save notes or log their contents. Notes are sent to OpenAI to make the answer or puzzles.

## Set up with an adult

1. Install Node.js on a computer, then open a terminal in this `study-helper` folder.
2. An adult signs in to Cloudflare and OpenAI Platform. The API may have separate usage costs from ChatGPT.
3. In Cloudflare, create a Turnstile widget for `dhairyagupta0103.github.io`. Its **site key** is public; its **secret key** must stay private.
4. In this folder, run `npx wrangler login` and then:

   ```text
   npx wrangler secret put OPENAI_API_KEY
   npx wrangler secret put TURNSTILE_SECRET_KEY
   npx wrangler deploy
   ```

   Paste each secret only into the private prompt from Wrangler. Do not paste it into chat or a GitHub file.
5. Copy the Worker URL that Wrangler prints. In the public `study-helper-config.js` file, set `endpoint` to that URL and `turnstileSiteKey` to the Turnstile **site key**. These two values are public and are not secret.
6. Upload the updated website files to GitHub Pages. Open Study Room and try the helper with notes that are okay to send to the AI service.

The Worker allows only the Study Desk GitHub Pages website, checks Turnstile tokens, limits each IP to about five requests per minute, and caps note/question sizes. Cloudflare's rate limit is approximate; it is a speed bump, not a strict spending limit. An adult should review OpenAI usage limits before connecting a real key.

For local development, copy `.dev.vars.example` to `.dev.vars` and replace the sample text there. `.dev.vars` is ignored by Git. Never commit it.

