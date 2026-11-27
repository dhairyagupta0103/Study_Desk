# Study Desk private helper

This Cloudflare Worker uses Cloudflare Workers AI through a private binding, so there is no OpenAI API key to add. The only private secret is the Turnstile secret; it must stay out of `index.html`, `app.js`, `study-helper-config.js`, and GitHub files.

The helper receives notes only after the student asks for help or presses Next in AI Mind Games. Study Room sends notes and a question for an answer. Mind Games sends notes to make a new number clue, word scramble, or riddle each time. It has no web search or other tools. Puzzle answers and evidence quotes are checked against the submitted notes. The Worker does not save notes or log their contents. Submitted notes go to Cloudflare Workers AI to make the answer or puzzle.

## Set up with an adult

1. An adult should keep the Cloudflare account on the **Workers Free plan**. Workers AI has a free daily allowance; on the Free plan, AI requests stop when that daily allowance is used. Do not switch to a paid plan.
2. Install Node.js on a computer, then open a terminal in this `study-helper` folder.
3. In Cloudflare, create a Turnstile widget for `dhairyagupta0103.github.io`. Its **site key** is public; its **secret key** must stay private. Turnstile has a free plan.
4. In this folder, run `npx wrangler login` and then:

   ```text
   npx wrangler secret put TURNSTILE_SECRET_KEY
   npx wrangler deploy
   ```

   Paste the Turnstile secret only into the private prompt from Wrangler. Do not paste it into chat or a GitHub file.
5. Copy the Worker URL that Wrangler prints. In the public `study-helper-config.js` file, set `endpoint` to that URL and `turnstileSiteKey` to the Turnstile **site key**. These two values are public and are not secret.
6. Upload the updated website files to GitHub Pages. Open Study Room and Mind Games and use notes that are okay to send to Cloudflare AI.

The Worker allows only the Study Desk GitHub Pages website, checks Turnstile tokens, limits each IP to about five requests per minute, and caps note/question sizes. AI Mind Games has no fixed puzzle count, but the daily free AI allowance and short request limit still apply; on the Free plan, requests stop after the daily AI allowance is used. Notes with only a few facts may lead to repeated ideas. An adult should confirm the account is still on the Free plan before deploying.

For local development, copy `.dev.vars.example` to `.dev.vars` and replace the sample text there. `.dev.vars` is ignored by Git. Never commit it.

