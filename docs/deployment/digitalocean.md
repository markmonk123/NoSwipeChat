# DigitalOcean Deployment

This repo is configured so DigitalOcean App Platform runs:

- the API in one container from `backend/Dockerfile`
- the web app in a separate container from `frontend/Dockerfile`
- path routing so `/api` and `/socket.io` go to the API service and `/` goes to the web service

Mobile store builds are configured through Expo EAS in `frontend/eas.json` and `frontend/.eas/workflows/build-and-submit.yml`.

## 1. Prerequisites

- A GitHub repo that DigitalOcean can read
- A MongoDB connection string
- A strong JWT secret
- A Facebook app ID
- Apple App Store Connect and Google Play Console accounts
- An Expo account for EAS Build and EAS Submit

## 2. Review the App Platform spec

The App Platform spec is in `/.do/app.yaml`.

Before deploying, update:

- `github.repo`
- `github.branch`
- `MONGODB_URI`
- `JWT_SECRET`
- `FACEBOOK_APP_ID`
- `PHONE_VERIFICATION_TEST_CODE`

The API service uses `${APP_URL}` for `FRONTEND_URLS`, so keep your production web domain set as the app's primary URL.

## 3. Create the DigitalOcean app

From the repo root:

```bash
doctl apps create --spec .do/app.yaml
```

To update the app later:

```bash
doctl apps update <app-id> --spec .do/app.yaml
```

## 4. API runtime variables

Set these on the API service:

- `MONGODB_URI`
- `JWT_SECRET`
- `FACEBOOK_APP_ID`
- `PHONE_VERIFICATION_TEST_CODE`
- `FRONTEND_URLS` if you need extra origins beyond the primary app URL

## 5. Web container behavior

The web container builds an Expo web export and serves it with Nginx.

Default behavior:

- Web API requests use the same origin under `/api`
- Web Socket.io traffic uses the same origin under `/socket.io`
- Facebook login can read the app ID from the API's public config endpoint

That means the DigitalOcean web service does not need a separate API base URL as long as ingress rules stay aligned with `/.do/app.yaml`.

## 6. Mobile builds for App Store and Google Play

Change into the Expo app:

```bash
cd frontend
```

Fill in the placeholders in `frontend/eas.json`:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_SOCKET_URL`
- `EXPO_PUBLIC_SOCKET_PATH`
- `EXPO_PUBLIC_FACEBOOK_APP_ID`
- `ascAppId`

Set the native identifiers in your shell or CI before building:

```bash
export IOS_BUNDLE_IDENTIFIER=com.yourcompany.noswipechat
export ANDROID_PACKAGE=com.yourcompany.noswipechat
export EAS_PROJECT_ID=your-project-id
```

Build production binaries:

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

Submit to the stores:

```bash
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

## 7. Recommended release checks

- Confirm the DigitalOcean app URL is live
- Confirm `/health` returns `200`
- Confirm `/api/health` returns `200`
- Confirm Facebook login works on web and native
- Confirm the API can connect to MongoDB
- Confirm nearby users, direct messages, and city chat work through the shared domain
