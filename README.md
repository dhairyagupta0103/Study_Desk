# Study Desk

A small, browser-based study organizer for keeping track of schoolwork and practising topics.

## Use it

Open `index.html` in a web browser. No account, server, or paid service is needed.

- Add assignments with a subject, due date, and notes.
- Delete schoolwork when you no longer need it.
- Open a task to turn it into a short checklist.
- Mark work complete and see this week's progress.
- Enter a topic in Study Room for a guided 20-minute practice plan and self-check questions.
- Use the focus timer when you want a quiet work session.
- Add an optional profile name shown in the page header.
- Paste schoolwork into Quick Add to get a subject, due-date, and task suggestion to review.
- Open Mind Games from the side menu for several number patterns, word scrambles, and riddles, with a Next button to keep playing. The Puzzle Box on Overview opens the same section.
- Make question-and-answer flashcards, tap to flip them, and try a short quiz.
- Use the Study-only AI helper once its private server is configured; it asks for a quote from the notes and says when it cannot find an answer.

Tasks, flashcards, the last topic, and the optional profile name are saved automatically in this browser on this device. A saved-status label confirms changes, and open tabs refresh when the saved data changes. They do not sync to other devices. When the AI helper is connected and used, the notes and question are sent to OpenAI for an answer; Study Desk does not save the AI request. Clearing this browser's site data will erase the saved information.

## Publish it

The site is made from static files, so it can be hosted by a static website service. Upload `index.html`, `styles.css`, `app.js`, `study-helper-config.js`, and `study-icon.svg` together; keep them in the same folder. The private Worker setup is in `study-helper/README.md`. `README.md` is for setup notes and is not needed by the site.

## Current scope

Study Room uses built-in subject-specific guides, including Hindi and Sanskrit, plus extra tips for some common topics. The AI helper is not active until its private Worker and adult-managed secrets are configured. Even when connected, it can make mistakes, so check its answer against the quoted notes. There is no online account system; the profile is only a name on this device and does not use a password or email.

