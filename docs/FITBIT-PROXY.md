# Fitbit proxy (fix CORS on web)

When the app runs in the **browser** (Expo web), the browser blocks direct requests to `api.fitbit.com` due to CORS. The app is configured to send Fitbit API requests through your backend when on web.

## Backend endpoint to add

**POST** `{API_BASE_URL2}/fitbit-proxy`

- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <user's Fitbit access token>`
- **Body:** `{ "url": "https://api.fitbit.com/1/user/-/sleep/date/2024-01-01/2024-01-30.json" }` (or any Fitbit API URL)
- **Behavior:** Your server should `GET` the given `url` with the same `Authorization` header and return the response body (JSON).
- **Response:** Return the same status and body as Fitbit’s API (e.g. 200 + JSON, or 401/4xx on error).

Example (Node):

```js
// POST /fitbit-proxy
const { url } = JSON.parse(req.body);
const auth = req.headers.authorization;
const res = await fetch(url, { headers: { Authorization: auth } });
const body = await res.text();
return { status: res.status, body };
```

## Fallback when proxy is missing

If the proxy is not implemented or returns an error, the **web** app will try to load **last synced data** from your existing `GET /fitbit?userId=...` endpoint and show a banner: “Showing last synced data (web). Open the app on your phone to refresh from Fitbit.”
