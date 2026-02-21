# OpevaSu Architecture (Current)

## Components
- Streamlit Web App (`app.py` + `components/`)
- Mobile App (Expo React Native, `mobile/app/`)
- Mobile Backend (Node.js/Express, `mobile/backend/`)
- MongoDB (`Users`, `Orders`, `Products`, `OrderHistory`)

## Runtime Flow
1. Mobile app calls Node backend endpoints.
2. Node backend reads/writes MongoDB directly.
3. Streamlit app continues to use its own Python side.

## Mobile Auth
- `POST /auth/login` returns JWT token.
- `orders` and `profile` routes require `Authorization: Bearer <token>`.
- Role rules:
  - `user`: own profile/orders only.
  - `admin`: can query `user_id` for cross-user order listing.

## Why This Structure
- Mobile side is decoupled from Python runtime.
- Streamlit remains untouched for existing web usage.
- APK can stay thin while backend runs centrally.
