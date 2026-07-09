# The Foosball World Cup 🏆

A tiny site for tracking a 5-player foosball tournament: a round-robin seeding
round followed by a knockout bracket (play-in → semifinals → final).
Free to host on GitHub Pages, no backend required.

## 1. Put this on GitHub

1. Create a new repo on GitHub (public or private both work), e.g. `foosball-world-cup`.
2. Upload all the files in this folder to the repo (or `git push` them).
3. In the repo, go to **Settings → Pages**, and under "Build and deployment"
   set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`.
4. After a minute your site will be live at
   `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`.

## 2. Point the site at your repo

Open `config.js` and fill in your details:

```js
const GITHUB_CONFIG = {
  owner: "YOUR_GITHUB_USERNAME",
  repo: "YOUR_REPO_NAME",
  branch: "main",
  dataPath: "data.json"
};
```

Commit and push that change. Everyone can now view standings, fixtures, and
the bracket at the URL above — no login needed for viewing.

## 3. Set up the admin

One of you should be "admin" — the person who's allowed to enter scores.
Scores are saved by committing directly to `data.json` in the repo, so the
admin needs a **GitHub personal access token**:

1. Go to **github.com/settings/tokens?type=beta** (Fine-grained tokens).
2. Click **Generate new token**.
3. Under **Repository access**, choose "Only select repositories" and pick this repo.
4. Under **Permissions → Repository permissions**, set **Contents** to
   **Read and write**.
5. Generate the token and copy it (it starts with `github_pat_...`).

On the site, click **Admin Login** in the top bar and paste the token in.
It's stored only in your browser (`localStorage`) and never sent anywhere
except directly to GitHub's API.

Once logged in, editable score boxes appear on the Fixtures and Bracket
pages. Enter scores, then hit **Save to GitHub** in the bar at the bottom —
this creates a commit updating `data.json`. GitHub Pages takes ~30–60
seconds to rebuild, so give it a moment before refreshing to check.

Click **Log Out** to clear the token from that browser.

## How the tournament works

**Seeding round:** everyone plays everyone once (10 games total). Standings
are ranked by points (3 for a win, 1 each for a tie, 0 for a loss), then
goal difference, then goals scored.

**Knockout round**, once every seeding match has a score:
- **Play-in:** Seed 4 vs Seed 5
- **Semifinal A:** Seed 1 vs (Play-in winner)
- **Semifinal B:** Seed 2 vs Seed 3
- **Final:** Semi A winner vs Semi B winner

Each knockout match unlocks for editing only once the matches it depends on
are finished, so you can't accidentally record a final before the semis
are played.

## Changing the players

Edit the `players` array in `data.json` (ids are lowercase, no spaces) and
update the `roundRobin` array so every pair of ids appears exactly once.
The hero graphic's rod labels update automatically to match player names.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `style.css` | Styling |
| `app.js` | Standings/bracket logic, admin login, GitHub save |
| `config.js` | Your repo details — edit this |
| `data.json` | All tournament data — the admin updates this via the site |
