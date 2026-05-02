// modules/calendar.js
// Uses Google Calendar API — requires GOOGLE_CALENDAR_TOKEN in environment
// Token obtained via OAuth2 (setup guide in README)

const BASE_URL = 'https://www.googleapis.com/calendar/v3';

function getToken() {
  return process.env.GOOGLE_CALENDAR_TOKEN || null;
}

async function calFetch(endpoint, method = 'GET', body = null) {
  const token = getToken();
  if (!token) {
    throw new Error(
      'Google Calendar not configured. Add GOOGLE_CALENDAR_TOKEN to your environment.'
    );
  }

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Calendar API error: ${response.status} — ${err}`);
  }

  return response.json();
}

async function calendarOperation(operation, params = {}) {
  switch (operation) {
    case 'list': {
      const daysAhead = params.days_ahead || 7;
      const now = new Date();
      const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

      const data = await calFetch(
        `/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${future.toISOString()}&orderBy=startTime&singleEvents=true&maxResults=10`
      );

      return data.items.map((event) => ({
        title: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location,
        description: event.description,
        id: event.id,
      }));
    }

    case 'create': {
      const startDate = new Date(params.date);
      const endDate = new Date(
        startDate.getTime() + (params.duration_minutes || 60) * 60 * 1000
      );

      const event = {
        summary: params.title,
        description: params.description || '',
        location: params.location || '',
        start: { dateTime: startDate.toISOString(), timeZone: 'Asia/Kolkata' },
        end: { dateTime: endDate.toISOString(), timeZone: 'Asia/Kolkata' },
      };

      const created = await calFetch(
        '/calendars/primary/events',
        'POST',
        event
      );
      return {
        created: true,
        id: created.id,
        title: created.summary,
        start: created.start?.dateTime,
      };
    }

    case 'delete': {
      await calFetch(
        `/calendars/primary/events/${params.event_id}`,
        'DELETE'
      );
      return { deleted: true, id: params.event_id };
    }

    default:
      throw new Error(`Unknown calendar operation: ${operation}`);
  }
}

module.exports = { calendarOperation };
