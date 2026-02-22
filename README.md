# Countdown Garden

Static GitHub Pages app for creating and sharing multiple countdowns using URL parameters.

## Pages
- `index.html`: lightweight landing page.
- `countdown.html`: main app page.
  - No `event` args: shows builder form.
  - With `event` args: shows sorted countdown cards.

## URL Format
Use repeated `event` query params:

```text
countdown.html?event=YYYY-MM-DD|HH:MM|+HH:MM|Title
```

You can pass multiple events:

```text
countdown.html?event=2026-12-31|23:59|+00:00|New%20Year&event=2026-07-04|09:00|-04:00|Parade
```

## Behavior
- Events are sorted so nearest upcoming events are first.
- Countdown values update every second.
- Past events are still shown and marked as passed.
- Form submission redirects to the same page with encoded URL args.
