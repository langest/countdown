# Countdown Garden

Shareable multi-event countdown app for GitHub Pages.

## Pages
- `index.html`: landing page.
- `countdown.html`: main app page.
  - No `event` args: shows builder form.
  - With `event` args: shows sorted countdown cards.

## URL Format
Use repeated `event` query params:

```text
countdown.html?event=YYYY-MM-DD|HH:MM|TimeZone|Title
```

`TimeZone` supports:
- IANA zone names (recommended): `America/New_York`, `Europe/Paris`
- UTC offsets (backward compatibility): `-05:00`, `+09:00`

Example:

```text
countdown.html?event=2026-12-31|23:59|America/New_York|New%20Year&event=2026-07-04|09:00|Europe/Paris|Parade
```

## Behavior
- Timezone defaults to the viewer's browser timezone in the form.
- IANA timezone events adjust automatically for DST based on each target date.
- Events are sorted so nearest upcoming events are first.
- Countdown values update every second.
- Past events are shown and marked as passed.
- Form submission redirects to the same page with encoded URL args.

## Deploy to GitHub Pages
1. Push files to a repository.
2. In repository settings, enable Pages from main branch root.
3. Open your Pages URL.
