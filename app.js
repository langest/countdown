const USER_TIME_ZONE = getUserTimeZone();
const TIMEZONE_FORMATTER_CACHE = new Map();

(function initApp() {
  const builderView = document.querySelector('#builder-view');
  const countdownView = document.querySelector('#countdown-view');

  if (!builderView || !countdownView) {
    return;
  }

  const events = parseEventsFromUrl();
  if (events.length > 0) {
    showCountdowns(events, builderView, countdownView);
    return;
  }

  showBuilder(builderView, countdownView);
})();

function parseEventsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const entries = params.getAll('event');
  if (entries.length === 0) {
    return [];
  }

  const parsed = [];
  for (const entry of entries) {
    const parts = entry.split('|');
    if (parts.length < 4) {
      continue;
    }

    const [date, time, tzRaw, ...titleParts] = parts;
    const title = titleParts.join('|').trim();
    const tz = normalizeTimeZoneInput(tzRaw);

    if (!isValidDate(date) || !isValidTime(time) || !isValidTimeZone(tz) || !title) {
      continue;
    }

    const targetMs = parseTargetMillis(date, time, tz);
    if (Number.isNaN(targetMs)) {
      continue;
    }

    parsed.push({
      title,
      date,
      time,
      tz,
      targetMs,
    });
  }

  return sortEvents(parsed);
}

function sortEvents(events) {
  const now = Date.now();
  return [...events].sort((a, b) => {
    const aRemaining = a.targetMs - now;
    const bRemaining = b.targetMs - now;
    const aUpcoming = aRemaining >= 0;
    const bUpcoming = bRemaining >= 0;

    if (aUpcoming && !bUpcoming) {
      return -1;
    }

    if (!aUpcoming && bUpcoming) {
      return 1;
    }

    if (aUpcoming && bUpcoming) {
      return a.targetMs - b.targetMs;
    }

    return b.targetMs - a.targetMs;
  });
}

function showBuilder(builderView, countdownView) {
  builderView.classList.remove('hidden');
  countdownView.classList.add('hidden');

  const rowContainer = document.querySelector('#event-rows');
  const addBtn = document.querySelector('#add-event');
  const form = document.querySelector('#event-form');

  if (!rowContainer || !addBtn || !form) {
    return;
  }

  addBuilderRow(rowContainer);

  addBtn.addEventListener('click', () => addBuilderRow(rowContainer));
  rowContainer.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('remove-event')) {
      return;
    }

    const row = target.closest('.event-row');
    if (!row) {
      return;
    }

    row.remove();
    if (rowContainer.children.length === 0) {
      addBuilderRow(rowContainer);
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const url = buildUrlFromForm(rowContainer);
    if (!url) {
      return;
    }

    window.location.assign(url);
  });
}

function addBuilderRow(rowContainer) {
  const template = document.querySelector('#event-row-template');
  if (!(template instanceof HTMLTemplateElement)) {
    return;
  }

  const node = template.content.cloneNode(true);
  const article = node.querySelector('.event-row');
  if (article) {
    const dateInput = article.querySelector('input[name="date"]');
    const timeInput = article.querySelector('input[name="time"]');
    const tzInput = article.querySelector('input[name="tz"]');

    if (dateInput instanceof HTMLInputElement && !dateInput.value) {
      dateInput.value = defaultDate();
    }

    if (timeInput instanceof HTMLInputElement && !timeInput.value) {
      timeInput.value = '09:00';
    }

    if (tzInput instanceof HTMLInputElement && !tzInput.value) {
      tzInput.value = USER_TIME_ZONE;
    }
  }

  rowContainer.appendChild(node);
}

function buildUrlFromForm(rowContainer) {
  const rows = Array.from(rowContainer.querySelectorAll('.event-row'));
  if (rows.length === 0) {
    return null;
  }

  const params = new URLSearchParams();

  for (const row of rows) {
    const title = readFieldValue(row, 'title');
    const date = readFieldValue(row, 'date');
    const time = readFieldValue(row, 'time');
    const tz = normalizeTimeZoneInput(readFieldValue(row, 'tz'));

    if (!title || !isValidDate(date) || !isValidTime(time) || !isValidTimeZone(tz)) {
      continue;
    }

    params.append('event', `${date}|${time}|${tz}|${title}`);
  }

  if (params.getAll('event').length === 0) {
    return null;
  }

  return `${window.location.pathname}?${params.toString()}`;
}

function readFieldValue(row, name) {
  const field = row.querySelector(`[name="${name}"]`);
  return field instanceof HTMLInputElement || field instanceof HTMLSelectElement
    ? field.value.trim()
    : '';
}

function showCountdowns(events, builderView, countdownView) {
  builderView.classList.add('hidden');
  countdownView.classList.remove('hidden');

  const list = document.querySelector('#countdown-list');
  const template = document.querySelector('#countdown-card-template');

  if (!(list instanceof HTMLElement) || !(template instanceof HTMLTemplateElement)) {
    return;
  }

  const cards = events.map((eventItem) => {
    const cardFragment = template.content.cloneNode(true);
    const card = cardFragment.querySelector('.countdown-card');
    if (!card) {
      return null;
    }

    const title = card.querySelector('.event-title');
    const target = card.querySelector('.event-target');

    if (title) {
      title.textContent = eventItem.title;
    }

    if (target) {
      target.textContent = `${eventItem.date} ${eventItem.time} (${formatTimeZoneLabel(eventItem.tz)})`;
    }

    list.appendChild(cardFragment);
    return { root: list.lastElementChild, event: eventItem };
  });

  const liveCards = cards.filter(Boolean);

  const update = () => {
    for (const card of liveCards) {
      updateCountdownCard(card.root, card.event);
    }
  };

  update();
  window.setInterval(update, 1000);
}

function updateCountdownCard(root, eventItem) {
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const remainingMs = eventItem.targetMs - Date.now();
  const absoluteMs = Math.abs(remainingMs);
  const seconds = Math.floor(absoluteMs / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  setText(root, '.days', String(days));
  setText(root, '.hours', String(hours));
  setText(root, '.minutes', String(minutes));
  setText(root, '.seconds', String(secs));

  const status = root.querySelector('.status');
  if (!(status instanceof HTMLElement)) {
    return;
  }

  if (remainingMs >= 0) {
    status.textContent = 'Upcoming';
    status.style.color = '#1e314a';
    return;
  }

  status.textContent = 'Passed';
  status.style.color = '#9b3f2a';
}

function setText(root, selector, value) {
  const node = root.querySelector(selector);
  if (node instanceof HTMLElement) {
    node.textContent = value;
  }
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value) {
  return /^\d{2}:\d{2}$/.test(value);
}

function isValidOffsetTz(value) {
  return value === 'Z' || /^[+-]\d{2}:\d{2}$/.test(value);
}

function isValidIanaTimeZone(value) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch (_) {
    return false;
  }
}

function isValidTimeZone(value) {
  return Boolean(value) && (isValidOffsetTz(value) || isValidIanaTimeZone(value));
}

function normalizeTimeZoneInput(value) {
  if (!value) {
    return '';
  }

  if (value === 'UTC' || value === 'utc' || value === 'Etc/UTC') {
    return 'UTC';
  }

  return value;
}

function parseTargetMillis(date, time, tz) {
  if (isValidOffsetTz(tz)) {
    return new Date(`${date}T${time}:00${tz}`).getTime();
  }

  return zonedDateTimeToUtcMillis(date, time, tz);
}

function zonedDateTimeToUtcMillis(date, time, timeZone) {
  const dateParts = parseDateTimeParts(date, time);
  if (!dateParts) {
    return Number.NaN;
  }

  const desiredUtcLike = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    dateParts.hour,
    dateParts.minute,
    0,
  );

  let guess = desiredUtcLike;
  for (let i = 0; i < 6; i += 1) {
    const zoned = getZonedParts(new Date(guess), timeZone);
    if (!zoned) {
      return Number.NaN;
    }

    const zonedAsUtcLike = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    );

    const diff = desiredUtcLike - zonedAsUtcLike;
    guess += diff;

    if (diff === 0) {
      break;
    }
  }

  const verify = getZonedParts(new Date(guess), timeZone);
  if (!verify) {
    return Number.NaN;
  }

  const exactMatch =
    verify.year === dateParts.year &&
    verify.month === dateParts.month &&
    verify.day === dateParts.day &&
    verify.hour === dateParts.hour &&
    verify.minute === dateParts.minute;

  return exactMatch ? guess : Number.NaN;
}

function parseDateTimeParts(date, time) {
  if (!isValidDate(date) || !isValidTime(time)) {
    return null;
  }

  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return null;
  }

  return { year, month, day, hour, minute };
}

function getZonedParts(date, timeZone) {
  const formatter = getTimeZoneFormatter(timeZone);
  if (!formatter) {
    return null;
  }

  const parts = formatter.formatToParts(date);
  const lookup = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      lookup[part.type] = part.value;
    }
  }

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
  };
}

function getTimeZoneFormatter(timeZone) {
  if (TIMEZONE_FORMATTER_CACHE.has(timeZone)) {
    return TIMEZONE_FORMATTER_CACHE.get(timeZone);
  }

  let formatter = null;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  } catch (_) {
    formatter = null;
  }

  TIMEZONE_FORMATTER_CACHE.set(timeZone, formatter);
  return formatter;
}

function getUserTimeZone() {
  try {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTimeZone && isValidIanaTimeZone(browserTimeZone)) {
      return browserTimeZone;
    }
  } catch (_) {
    return 'UTC';
  }

  return 'UTC';
}

function formatTimeZoneLabel(timeZone) {
  if (isValidOffsetTz(timeZone)) {
    return timeZone === 'Z' ? 'UTC' : `UTC${timeZone}`;
  }

  return timeZone;
}

function defaultDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}
