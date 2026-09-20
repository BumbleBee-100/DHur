## Browser for CloudPhone

A lightweight, always-dark web-search browser widget with an address bar, a
switchable search engine, bookmarks and history, built for CloudPhone
feature phones (240x320 screens) with softkey navigation.

- **Address bar** — type a search or a full address.
- **Search engine** — Google by default; pick another built-in engine or add
  your own from the dropdown.
- **Bookmarks** — Facebook, YouTube and Gmail are added by default. Press
  **Edit** (right softkey) to remove any of them or add your own.
- **Menu** (left softkey) — Bookmarks, Enter address, Start page, History,
  Backward, Forward, Reload, Exit. **Backward**/**Forward** only appear once
  there is somewhere to go, like a normal browser's back/forward buttons.

## Add to CloudPhone
1. Go to the [CloudPhone Developer Page](https://www.cloudfone.com/my).
2. Select **Add Widget**.
3. Paste this Start URL:
   `https://<your-github-username>.github.io/<your-repo-name>`
4. Upload `icon.png` if required.
5. Save and refresh — **Browser** will appear on your CloudPhone.

## Run locally / host on GitHub Pages
This is a static site (`index.html`, `style.css`, `script.js`) — no build
step. To host it:
1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages**, set the source to the `main`
   branch (root), and save.
3. Your widget will be live at `https://<username>.github.io/<repo-name>`.
