# Peggy Starter (Public Scaffold)

This is the public starter version of Peggy.

## What is blank by default
- Due date
- Contacts
- Doctor info
- All progress/checklists/logs
- Cloud account/session data

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Optional cloud sync (Supabase)
1. Copy `.env.example` values into `.env.local`.
2. Add your own project URL and anon key.
3. Run the app and sign up/sign in in `More > Backup`.

## Notes
- Data is account-isolated when cloud sync is enabled.
- This scaffold is generic and intended for new users to fill with their own details.