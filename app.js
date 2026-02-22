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

    const [date, time, tz, ...titleParts] = parts;
    const title = titleParts.join('|').trim();
    if (!isValidDate(date) || !isValidTime(time) || !isValidOffsetTz(tz) || !title) {
      continue;
    }

    const isoWithOffset = `${date}T${time}:00${tz}`;
    const targetMs = new Date(isoWithOffset).getTime();
    if (Number.isNaN(targetMs)) {
      continue;
    }

    parsed.push({
      title,
      date,
      time,
      tz,
      isoWithOffset,
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
    if (dateInput instanceof HTMLInputElement && !dateInput.value) {
      dateInput.value = defaultDate();
    }
    if (timeInput instanceof HTMLInputElement && !timeInput.value) {
      timeInput.value = '09:00';
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
    const tz = readFieldValue(row, 'tz');

    if (!title || !isValidDate(date) || !isValidTime(time) || !isValidOffsetTz(tz)) {
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
      target.textContent = `${eventItem.date} ${eventItem.time} (UTC${eventItem.tz})`;
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

function defaultDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}
