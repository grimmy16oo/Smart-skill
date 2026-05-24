# SkillSwap Backend

Node.js, Express, MongoDB, JWT auth, and Socket.IO backend for the SkillSwap app.

## Setup

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Create `backend/.env` from the example:
   ```bash
   copy .env.example .env
   ```

3. Set these values in `backend/.env`:
   ```env
   PORT=5000
   CLIENT_ORIGIN=http://localhost:5173
   MONGODB_URI=mongodb://127.0.0.1:27017/smart-skill-exchange
   JWT_SECRET=replace-this-with-a-long-random-secret
   ```

4. Start the backend:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:5000`.

## API Endpoints

### Auth

- `POST /api/auth/register` - Create a user and return a JWT.
- `POST /api/auth/login` - Log in and return a JWT.
- `GET /api/auth/me` - Get the current user.
- `PUT /api/auth/profile` - Update the current user's profile.

### Users

- `GET /api/users/featured?limit=3` - Public featured members for the home page.
- `GET /api/users/swipe` - Authenticated swipe deck with already-liked/matched users hidden.
- `GET /api/users` - Authenticated list of other users.
- `GET /api/users/:id` - Authenticated user profile lookup.

### Matches

- `GET /api/matches` - Current user's matches.
- `POST /api/matches/like/:targetId` - Record a like; returns a match when the like is mutual.
- `DELETE /api/matches/like/:targetId` - Undo a like.
- `POST /api/matches/skip/:targetId` - Record a rejected profile for recommendation learning.
- `DELETE /api/matches/skip/:targetId` - Undo a rejected profile signal.
- `POST /api/matches/:targetId` - Directly create a match.

### Messages

- `POST /api/messages/:matchId/ensure` - Verify that the current user can access a chat.
- `GET /api/messages/:matchId` - Get chat history for a match.
- `POST /api/messages/:matchId` - Save a new message.

## Authentication

Send the JWT on protected routes:

```http
Authorization: Bearer <token>
```
