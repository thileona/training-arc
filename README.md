# Training Arc

Installable web app (PWA) to record a daily push-up ramp and treadmill sessions.

- **Ascent**: every push-up is one metre climbed, from the Atomium to the edge of space.
- **Journey**: treadmill kilometres move you along the road from Brussels to Rome.
- Daily push-up target ramps from 25 to 100 (editable in Log > Plan).
- Works offline. Data stays in the browser; use Log > Backup to export it.

## Deploy on GitHub Pages

1. Create an empty repository on GitHub (for example `training-arc`).
2. Push this folder:
   ```
   git remote add origin https://github.com/<you>/training-arc.git
   git push -u origin main
   ```
3. In the repository: Settings > Pages > Source "Deploy from a branch", branch `main`, folder `/ (root)`.
4. Open `https://<you>.github.io/training-arc/` in Chrome on the phone, then menu > "Add to Home screen" > Install.

## Updating

Change the files, bump `CACHE` in `sw.js`, push. The phone picks up the new version on the second launch.

## Customising

The route and the landmarks are the two arrays at the top of `app.js`.
