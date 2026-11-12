# SPAIN // COMMAND DECK

A fully working, standalone, JARVIS-inspired **Home Screen web app** for iPhone running iOS 27. The app runs on-device after being installed from an HTTPS website. This is not a SpringBoard replacement, full jailbreak, or an always-listening AI.

## Features
- Responsive animated reactor dashboard (respects Reduce Motion)
- Live local time/date and a local task queue
- Spoken briefing on user tap, subject to iOS browser voice availability
- Configurable quick links for SPAIN, ChatGPT, and Zoho Mail
- Runs any **existing** Apple Shortcut by name using the `shortcuts://` URL scheme (iOS may ask for confirmation)
- Theme accent selection; saved locally
- Offline shell using a service worker (once loaded from a HTTPS host)
- Nine matching shortcut icon images in `icon-pack/`

## Publish free using GitHub Pages
1. On GitHub, create a new **public** repository named `spain-command-deck` (or a name of your choice). Don't upload secrets.
2. Choose **Add file > Upload files**. Upload `index.html`, `manifest.webmanifest`, `sw.js`, and the `icons` folder contents, preserving the folder structure. The `icon-pack` images are optional for deployment.
3. In the repository, go to **Settings > Pages > Build and deployment**. Set **Deploy from a branch**, branch **main**, folder **/(root)**, then Save.
4. GitHub displays an HTTPS Pages URL, normally `https://YOUR-USERNAME.github.io/spain-command-deck/`. Use the actual URL shown by GitHub.
5. Open the live URL in **Safari on your iPhone**. Tap Share > Add to Home Screen. Choose **Open as Web App** when available, then Add.
6. Open the new SPAIN Deck icon on your Home Screen. Go to CONFIG and add your own SPAIN address and Apple Shortcut name.

## Pair with native iOS Home Screen
- Long-press a Home Screen page > Edit > Customize > Dark or Tinted; choose a cyan tint.
- Use Apple's Shortcuts app > create shortcut > Add to Home Screen > Choose File to assign any icon from `icon-pack/` to app shortcuts.
- Install **Widgy** from the App Store to make a matching clock, calendar, and status widget.
- Customize Control Center and Lock Screen controls for your favorite shortcuts.

## Notes
- SPAIN Quick Access is a **link** to your existing assistant, not a connection until you configure a reachable URL.
- For your Ubuntu SPAIN server, a local HTTP address may work only while the phone is on the same network; remote access requires an appropriately secured HTTPS/VPN setup. Do not expose an unauthenticated server to the public internet.
- No credentials should be entered in this app. Sign in only on official destination services.
- Todo items and config are held in your iPhone web app's local storage. iOS may clear website data; do not use it for irreplaceable information.
- The app does not claim to read device battery, health data, phone notifications, or run continuously in the background.
- If the app changes after deployment, reload once while online to update its cached shell. Removing and reinstalling can clear locally saved settings/tasks.
