# Smart Skill Exchange

React + Vite frontend with a Node.js, Express, MongoDB, JWT, and Socket.IO backend.

## Run Locally

1. Install frontend dependencies:
   ```bash
   npm install
   ```

2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   cd ..
   ```

3. Create backend environment file:
   ```bash
   copy backend\.env.example backend\.env
   ```

4. Edit `backend/.env`:
   ```env
   PORT=5000
   CLIENT_ORIGIN=http://localhost:5173
   MONGODB_URI=mongodb://127.0.0.1:27017/smart-skill-exchange
   JWT_SECRET=replace-this-with-a-long-random-secret
   ```

5. Run both frontend and backend:
   ```bash
   npm run dev:all
   ```

6. Open `http://localhost:5173`.

## MongoDB

You can use either local MongoDB or MongoDB Atlas.

- Local MongoDB: install MongoDB Community Server and keep `MONGODB_URI=mongodb://127.0.0.1:27017/smart-skill-exchange`.
- MongoDB Atlas: create a free cluster, copy the connection string, and put it in `backend/.env`.

## Useful Commands

```bash
npm run lint
npm run build
npm run dev:server
```
