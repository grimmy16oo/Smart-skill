# Smart Skill Exchange Defense Guide

This guide is based on this codebase only. It does not claim features that are not implemented.

## 1. Authentication

Files: `src/pages/LoginPage.jsx`, `src/context/AuthContext.jsx`, `src/services/authService.js`, `src/services/api.js`, `backend/routes/auth.js`, `backend/middleware/auth.js`, `backend/models/User.js`, `backend/config/firebaseAdmin.js`.

Registration starts in `LoginPage.handleSubmit`. In signup mode it calls `register(email, password, profileData)` from `AuthContext`, which calls `registerWithProfile` in `authService.js`. That sends `POST /api/auth/register` with name, email, password, location, bio, and empty skill arrays. `backend/routes/auth.js` validates required fields, normalizes email, checks duplicate users, cleans text/skills, and creates a `User`. The `User` schema has a `pre("save")` hook that hashes the password with `bcrypt.genSalt(10)` and `bcrypt.hash`. The response contains `token: generateToken(user._id)` and `user: serializeUser(user)`.

Login starts in `LoginPage.handleSubmit` in login mode. It calls `login`, then `loginUser`, then `POST /api/auth/login`. The backend loads the user with `.select("+password")` because the password field is normally hidden. It calls `user.matchPassword(password)`, which uses `bcrypt.compare`. If valid, the backend returns a JWT and serialized user.

Logout is frontend-only. `Navbar.handleLogout` calls `logout` from `AuthContext`, which calls `logoutUser`. That signs out Firebase only if a Google user is active, then removes `skillswap_token` from `localStorage`. There is no server-side token blacklist.

JWT/session/cookies: this project uses JWT Bearer tokens, not cookie sessions. `src/services/api.js` stores the token in `localStorage` under `skillswap_token`. Every `apiRequest` adds `Authorization: Bearer <token>` if present. `backend/middleware/auth.js` verifies the token with `jwt.verify`, sets `req.userId`, and lets the protected route continue.

Protected routes are backend routes using `protect`: `/api/auth/me`, `/api/auth/profile`, most `/api/users`, `/api/matches`, `/api/messages`, `/api/sessions`, uploads, calendar, swap requests, and profile feature write routes.

Google login exists. `authService.loginWithGoogle` uses Firebase `signInWithPopup`, gets a Firebase ID token, then calls `POST /api/auth/google`. The backend verifies it with `verifyGoogleIdToken`, creates or updates a MongoDB `User`, then returns this app's own JWT.

Security strengths: bcrypt password hashing, JWT expiration of 30 days, protected middleware, password excluded by default with `select: false`, server-side ownership checks on profile features, CORS configured in `server.js`.

Limitations: token stored in `localStorage` can be stolen by XSS; dev fallback secret is `dev-secret-change-me`; logout does not invalidate existing JWTs; no rate limiting; no email verification; no password reset.

If teacher asks how login is secured: "The password is never stored as plain text. In `backend/models/User.js`, a Mongoose pre-save hook hashes it using bcrypt before saving. During login, `backend/routes/auth.js` loads the password only for comparison and uses `bcrypt.compare`. If correct, the backend sends a signed JWT. The frontend stores that token and sends it in the Authorization header. Protected routes use `backend/middleware/auth.js` to verify the JWT before accessing data."

## 2. User Profiles

Files: `ProfilePage.jsx`, `AuthContext.jsx`, `userService.js`, `backend/routes/auth.js`, `backend/routes/users.js`, `backend/models/User.js`, `backend/utils/serializers.js`.

Profile creation happens during registration. The `User` document stores `name`, `email`, `avatar`, `bio`, `location`, `skillsOffered`, `skillsWanted`, rating fields, `availability`, and notification preferences. Editing is in `ProfilePage.handleSave`, which calls `updateUserProfile`. That calls `PUT /api/auth/profile`. The backend allows only `name`, `avatar`, `bio`, `location`, `skillsOffered`, and `skillsWanted`.

Profile view for another user uses `ProfilePage` with `/profile/:id`. It calls `getUserProfile(id)` from `userService.js`, which calls `GET /api/users/:id`. The backend returns `serializeUser(user)`.

Skills are stored as arrays on the `User` document: `skillsOffered` means "I can teach this"; `skillsWanted` means "I want to learn this". Skill metadata, such as level and endorsements, is separate in `mongoRoutes.js` as `SkillMeta`.

Weaknesses: profile update has no image URL validation for manual avatar string updates; skills are free-text so duplicates with different spelling can happen; public profile lookup is protected, so users must log in to view profiles.

## 3. Image Upload

Files: `ProfilePage.handlePhotoChange`, `userService.uploadAvatar`, `backend/routes/uploads.js`, `backend/server.js`, `backend/models/User.js`.

Storage: local backend disk, not Cloudinary, not Firebase Storage, not MongoDB, not base64. Files are stored in `backend/uploads/avatars`. MongoDB stores only the URL string in `User.avatar`.

Flow:

User chooses an image in `ProfilePage.jsx` -> `handlePhotoChange` validates image type and max 3 MB -> `uploadAvatar(file)` creates `FormData` with key `avatar` -> `POST /api/uploads/avatar` -> `backend/routes/uploads.js` uses `multer.diskStorage` -> filename is `${req.userId}-${Date.now()}${ext}` -> file is saved under `backend/uploads/avatars` -> backend builds URL like `http://localhost:5000/uploads/avatars/file.jpg` -> backend updates `User.avatar` -> frontend refreshes profile -> `UserAvatar`/`SwipeCard` display the URL.

Beginner explanation: the image itself is saved like a normal file in a folder on the backend computer. The database does not keep the image bytes. It only keeps the address of the image, like saving a house address instead of storing the whole house.

Limitations: local files can disappear if deployed to an ephemeral host; old avatars are not deleted; no image resizing; no virus scanning; no Cloudinary/Firebase CDN.

## 4. AI Matching

Files: `backend/utils/matching.js`, `backend/routes/users.js`, `backend/routes/matches.js`, `src/services/userService.js`, `src/pages/SwipePage.jsx`.

This is not real AI or machine learning. It is a rule-based scoring algorithm with behavior signals. `computeMatchPercent(currentUser, otherUser, behaviorProfile)` calculates a score from skill overlap, location, rating, and previous like/skip behavior.

Formula in `matching.js`: current user's wanted skills overlapping other user's offered skills can add up to 42 points. Other user's wanted skills overlapping current user's offered skills can add up to 34. Shared offered skills add up to 5. Shared wanted skills add up to 5. Same location adds 4. Other user's rating adds up to 6. Behavior profile can add up to 8 for liked skill signals and subtract up to 12 for skipped skill signals. Result is rounded and capped from 0 to 99.

Recommendations are loaded by `GET /api/users/swipe`. The backend hides current user, already liked users, and matched users, computes scores, then sorts by `matchPercent` descending and newest user second.

If teacher asks "Where is the AI?": "In this version, the matching is called smart/AI matching in the UI, but technically it is a rule-based recommendation algorithm. The logic is in `backend/utils/matching.js`. It scores users by skill compatibility, location, rating, and previous swipe behavior. It does not call an external AI model."

## 5. Swipe System

Files: `SwipePage.jsx`, `SwipeCard.jsx`, `matchService.js`, `backend/routes/users.js`, `backend/routes/matches.js`, `Like.js`, `SwipeAction.js`, `Match.js`.

`SwipeCard` detects drag direction: right over 120 pixels calls `onSwipe("like")`; left below -120 calls `onSwipe("skip")`. Buttons in `SwipePage` call the same handler.

Swipe right calls `recordSwipeLike`, which sends `POST /api/matches/like/:targetId`. The backend stores a `Like` document `{fromUser, toUser}` and a `SwipeAction` document `{user, targetUser, action:"like", scoreSnapshot}`. Then it checks if the target user already liked the current user. If yes, `createMutualMatch` creates/updates a `Match` with sorted `users`, unique `key`, `matchPercent`, and `status:"matched"`.

Swipe left calls `recordSwipeSkip`, which sends `POST /api/matches/skip/:targetId`. That stores only `SwipeAction` with `action:"skip"`. A skip does not create a match.

Weakness: deleting a like removes the `Like` and matching `SwipeAction`, but it does not remove an already-created `Match`.

## 6. Chat System

Files: `ChatPage.jsx`, `chatService.js`, `socketService.js`, `backend/routes/messages.js`, `backend/socket/chatSocket.js`, `Message.js`, `Match.js`.

Chats are based on `Match` documents. There is no separate Conversation model. `matchId` is the conversation ID. `ChatPage` loads matches with `fetchMatches`, then loads peer profiles and messages. `ensureChatForMatch` calls `POST /api/messages/:matchId/ensure` to verify that the user belongs to that match.

Messages are saved in MongoDB `Message` documents with `match`, `sender`, `text`, `read`, `isDeleted`, and `deletedAt`. Sending through `ChatPage.handleSend` calls REST `sendMessage`, which posts to `/api/messages/:matchId`. The backend saves the message, updates `Match.lastMessageText`, `lastMessageSender`, `lastMessageAt`, and emits `new_message` through Socket.IO.

Real-time exists through Socket.IO. `socketService.joinMatchRoom` connects with JWT auth and emits `join_match`. `chatSocket.js` verifies the socket JWT, checks the user is in the match, and joins room `match:<matchId>`. It also supports socket `send_message`, `unsend_message`, `typing`, and `message_seen`, although the current `ChatPage` mainly uses REST for sending and listens for `new_message`.

Limitations: read receipts are emitted but `Message.read` is not updated; local file attachments in `ChatPage` are UI previews only and are not uploaded because `sendMessage` ignores a file parameter; no pagination.

## 7. Scheduling

Files: `AvailabilityCalendar.jsx`, `calendarService.js`, `profileFeatureService.js`, `backend/routes/sessions.js`, `backend/models/Session.js`, `backend/services/googleCalendarService.js`.

Availability is stored on the `User` document as `availability.recurring`: `dayOfWeek`, `startTime`, `endTime`, and `timezone`. `AvailabilityCalendar.handleSave` calls `updateUserAvailability`, which sends `PUT /api/users/:uid/availability` handled by `mongoRoutes.js`.

A session request starts when a matched user opens another profile and uses the schedule section. `AvailabilityCalendar.handleBook` builds `scheduledAt` from selected date/time and calls `bookSession`, which posts to `/api/sessions`. Because `server.js` mounts `sessionRoutes` before `mongoRoutes`, this uses `backend/routes/sessions.js`, not the simpler route in `mongoRoutes.js`.

The backend validates target user, date, duration, teacher/learner IDs, and optional `matchId`. It creates a `Session` with `status:"pending"`, `requesterId`, `targetId`, `teacherId`, `learnerId`, `scheduledAt`, `durationMinutes`, `skill`, `meetingLink`, and `proposedBy`.

The other user accepts by clicking Confirm. `AvailabilityCalendar.handleSessionAction(...,"confirm")` calls `POST /api/sessions/:id/confirm`. The backend prevents the proposer from confirming their own request, changes status to `confirmed`, sets `confirmedBy`, and tries to create a Google Calendar event if either participant connected calendar credentials.

Reschedule is teacher-only in `PATCH /api/sessions/:id/reschedule`. Cancel uses `DELETE /api/sessions/:id`, which marks status `cancelled`.

Limitations: booking does not check whether the selected time falls inside the target user's availability; there is no overlap detection; no reminders.

## 8. Session Completion

Files: `AvailabilityCalendar.jsx`, `backend/routes/sessions.js`, `Session.js`, `Activity.js`.

The project knows a learning session is completed only when a user manually clicks "Complete exchange" in the UI. `AvailabilityCalendar` shows this button when `session.status === "confirmed"`. It calls `POST /api/sessions/:id/complete`. The backend allows any participant to complete a confirmed session, sets `session.status = "completed"`, saves it, and creates two `Activity` documents: one `taught` for the teacher and one `learned` for the learner.

It is not automatic or time-based. It does not verify that the scheduled time has passed. It does not require both users to confirm completion.

Industry-standard improvement: use statuses like `pending`, `confirmed`, `in_progress`, `completed_pending_peer`, `completed`, `disputed`, `cancelled`; require completion only after `scheduledAt + durationMinutes`; collect completion confirmation from both participants; allow disputes; then unlock reviews only for completed sessions.

## 9. Reviews and Ratings

Files: `ProfilePage.jsx`, `userService.js`, `backend/routes/users.js`, `Review.js`, `User.js`.

Reviews are shown in profile section. A review form appears only in the frontend when viewing another matched user. Submitting calls `createUserReview`, which posts to `POST /api/users/:id/reviews`.

Backend rules: user cannot review self; rating must be integer 1-5; text required; reviewer must have a `Match` with target. It does not verify that a session happened or was completed. It then upserts one review per reviewer/target pair because `Review` has unique index `{fromUser, toUser}`. After saving, it recalculates average rating and `reviewCount` on `User`.

Loophole: matched users can review each other even if they never scheduled or completed a session.

## 10. Notifications

Real notification delivery is not implemented. There is only notification preference storage on `User.notifPrefs` through `GET/PUT /api/users/:uid/notif-prefs` in `mongoRoutes.js` and functions in `profileFeatureService.js`. There is no in-app notification collection, email sender, push notification, or notification UI.

## 11. Portfolio

Files: `PortfolioShowcase.jsx`, `profileFeatureService.js`, `backend/routes/mongoRoutes.js`.

Projects are CRUD through REST. `PortfolioShowcase` loads `getUserProjects(uid)`, adds with `addProject`, edits with `updateProject`, deletes with `deleteProject`. Backend inline `Project` schema in `mongoRoutes.js` uses `userId`, `title`, `description`, `githubUrl`, `demoUrl`, `beforeImage`, `afterImage`, `skillsUsed`, `collaborators`, `_githubMeta`.

Images are not uploaded by this portfolio feature. `beforeImage` and `afterImage` are URL strings entered by the user. GitHub metadata can be fetched client-side from `https://api.github.com/repos/:owner/:repo`.

Note: there is also `backend/models/Project.js` with fields `user`, `title`, `description`, `githubUrl`, `imageUrl`, but the active routes use the inline schema in `mongoRoutes.js`.

## 12. Availability

Availability model is embedded in `User`: `availability.recurring[]` with day/time strings and `timezone`. `AvailabilityCalendar` edits and displays it. Scheduling displays availability but does not enforce it in `sessions.js`.

## 13. Database Collections

`users`: auth/profile, availability, notification prefs, stats. Fields include identity (`name`, `email`, `password`, `authProvider`, `googleUid`), profile (`avatar`, `bio`, `location`), skills (`skillsOffered`, `skillsWanted`), reputation (`rating`, `reviewCount`), counts/matches, availability, and notification prefs.

`likes`: one-way likes with `fromUser`, `toUser`. Used to detect mutual likes.

`swipeactions`: behavior history with `user`, `targetUser`, `action`, `scoreSnapshot`. Used for recommendation signals.

`matches`: two users, unique `key`, `matchPercent`, `status`, last message preview fields. Used for chat and reviews.

`messages`: `match`, `sender`, `text`, `read`, deletion fields. Used by REST and Socket.IO chat.

`sessions`: requester/target, teacher/learner, `matchId`, `skill`, `scheduledAt`, `durationMinutes`, `meetingLink`, proposed/confirmed users, `status`, and Google Calendar event data.

`reviews`: `fromUser`, `toUser`, `rating`, `text`; unique one review per pair.

`activities`: `userId`, `type`, `skill`, partner info, `completedAt`, `sessionDuration`; created when a session is completed.

`swaprequests`: matched-user exchange request with requester, recipient, match, offered/wanted skill, message, status, timeline.

`googlecredentials`: encrypted Google access/refresh token storage for calendar integration.

Inline `mongoRoutes.js` collections: `projects`, `presence`, `skillmetas`. These are active because `mongoose.models.X || mongoose.model("X", schema)` is used.

## 14. API Table

| Endpoint | Method | Purpose | Frontend file | Backend | Models |
|---|---:|---|---|---|---|
| `/api/auth/register` | POST | Register | `authService.js` | `auth.js` | User |
| `/api/auth/login` | POST | Login | `authService.js` | `auth.js` | User |
| `/api/auth/google` | POST | Google login | `authService.js` | `auth.js` | User |
| `/api/auth/me` | GET | Current user | `AuthContext.jsx` | `auth.js` | User |
| `/api/auth/profile` | PUT | Edit profile | `userService.js` | `auth.js` | User |
| `/api/uploads/avatar` | POST | Upload avatar | `userService.js` | `uploads.js` | User + local files |
| `/api/users/featured` | GET | Home cards | `HomePage.jsx` | `users.js` | User |
| `/api/users/swipe` | GET | Swipe deck | `userService.js` | `users.js` | User, Like, Match, SwipeAction |
| `/api/users/:id` | GET | Profile | `userService.js` | `users.js` | User |
| `/api/users/:id/reviews` | GET/POST | Reviews | `ProfilePage.jsx` | `users.js` | Review, Match, User |
| `/api/matches` | GET | Matches | `matchService.js` | `matches.js` | Match |
| `/api/matches/like/:targetId` | POST/DELETE | Like/undo | `SwipePage.jsx` | `matches.js` | Like, SwipeAction, Match, User |
| `/api/matches/skip/:targetId` | POST/DELETE | Skip/undo | `SwipePage.jsx` | `matches.js` | SwipeAction, User |
| `/api/messages/:matchId` | GET/POST | Chat history/send | `ChatPage.jsx` | `messages.js` | Message, Match |
| `/api/sessions` | GET/POST | Sessions | `AvailabilityCalendar.jsx` | `sessions.js` | Session, Match, User |
| `/api/sessions/:id/confirm` | POST | Accept session | `calendarService.js` | `sessions.js` | Session, GoogleCredential |
| `/api/sessions/:id/reschedule` | PATCH | Reschedule | `calendarService.js` | `sessions.js` | Session |
| `/api/sessions/:id/complete` | POST | Complete | `calendarService.js` | `sessions.js` | Session, Activity |
| `/api/sessions/:id` | DELETE | Cancel | `calendarService.js` | `sessions.js` | Session |
| `/api/users/:uid/availability` | GET/PUT | Availability | `AvailabilityCalendar.jsx` | `mongoRoutes.js` | User |
| `/api/users/:uid/projects` | GET/POST | Portfolio | `PortfolioShowcase.jsx` | `mongoRoutes.js` | Project |
| `/api/projects/:id` | PUT/DELETE | Portfolio edit/delete | `PortfolioShowcase.jsx` | `mongoRoutes.js` | Project |
| `/api/presence/:uid` | GET/PUT | Presence | `PresenceIndicator.jsx` | `mongoRoutes.js` | Presence |
| `/api/users/:uid/skill-meta` | GET/PUT | Skill metadata | `ProfilePage.jsx` | `mongoRoutes.js` | SkillMeta |
| `/api/users/:uid/notif-prefs` | GET/PUT | Preferences only | `profileFeatureService.js` | `mongoRoutes.js` | User |
| `/api/calendar/*` | GET/DELETE | Google Calendar OAuth | `calendarService.js` | `googleCalendar.js` | GoogleCredential |
| `/api/swap-requests` | GET/POST | Swap requests | currently no visible main page use found | `swapRequests.js` | SwapRequest, Match |

## 15. Project Architecture

React/Vite frontend -> `apiRequest` adds JSON/FormData headers and JWT -> Express route -> `protect` middleware for private endpoints -> Mongoose model reads/writes MongoDB -> optional local storage folder for avatars or Google Calendar API for events -> serialized JSON response -> React state updates UI.

Socket architecture: React `socketService` -> Socket.IO server -> JWT verified in `chatSocket.js` -> room `match:<id>` -> MongoDB message save -> `new_message` emitted to both users.

## 16. Major Libraries

React renders pages/components. Vite runs/builds frontend. React Router controls `/`, `/login`, `/swipe`, `/chat`, `/profile`. Framer Motion handles animations and swipe dragging. Lucide React provides icons. Tailwind and DaisyUI style the UI. Firebase client is used for Google sign-in and a leftover Firestore service file. Socket.IO client/server powers realtime chat. Express builds APIs. Mongoose maps MongoDB collections. bcryptjs hashes passwords. jsonwebtoken signs/verifies JWT. multer handles multipart avatar upload. cors allows frontend/backend communication. dotenv loads environment variables. firebase-admin verifies Google ID tokens. googleapis connects Google Calendar. concurrently runs frontend and backend together.

If removed: removing React/Vite breaks frontend; Express/Mongoose breaks backend/database; JWT breaks protected auth; bcrypt breaks secure password storage; multer breaks avatar upload; Socket.IO removes realtime chat; googleapis removes calendar sync.

## 17. 100 Viva Questions With Short Answers

1. Teacher: What stack did you use? Student: React/Vite frontend, Express backend, MongoDB with Mongoose, JWT auth, Socket.IO chat.
2. Teacher: Where is user data stored? Student: In MongoDB `users` collection through `backend/models/User.js`.
3. Teacher: Are passwords plain text? Student: No, bcrypt hashes them in the User pre-save hook.
4. Teacher: What happens during login? Student: Backend finds user by email, compares bcrypt password, returns JWT.
5. Teacher: Where is the JWT stored? Student: In browser `localStorage` as `skillswap_token`.
6. Teacher: How are protected APIs protected? Student: `protect` middleware verifies Bearer JWT.
7. Teacher: Do you use cookies? Student: No, Authorization Bearer token.
8. Teacher: What is a weakness of localStorage JWT? Student: XSS could steal it.
9. Teacher: Does logout invalidate token on server? Student: No, it removes it from frontend only.
10. Teacher: What is Google auth used for? Student: Firebase popup verifies Google identity, backend creates app JWT.
11. Teacher: Where are profile fields defined? Student: In `User.js`.
12. Teacher: How do you edit profile? Student: `PUT /api/auth/profile`.
13. Teacher: Who can edit my profile? Student: Only the logged-in user because route uses JWT `req.userId`.
14. Teacher: Where are skills stored? Student: `skillsOffered` and `skillsWanted` arrays on User.
15. Teacher: How is profile image uploaded? Student: Multer saves it to `backend/uploads/avatars`.
16. Teacher: Is image stored in MongoDB? Student: No, only image URL is stored.
17. Teacher: Is Cloudinary used? Student: No.
18. Teacher: Is Firebase Storage used? Student: No.
19. Teacher: What is `multer`? Student: Middleware for handling file uploads.
20. Teacher: What size limit for avatar? Student: 3 MB.
21. Teacher: What is AI matching? Student: Rule-based score in `matching.js`.
22. Teacher: Is it real AI? Student: No external AI model; smart algorithm only.
23. Teacher: Main matching factor? Student: Wanted skills overlapping offered skills.
24. Teacher: How are users sorted in swipe? Student: By match percent, then newest.
25. Teacher: What does swipe right do? Student: Creates Like and SwipeAction, maybe Match.
26. Teacher: What does swipe left do? Student: Stores a skip SwipeAction.
27. Teacher: How does mutual match happen? Student: If reverse Like exists, create Match.
28. Teacher: What stores one-way likes? Student: `Like` model.
29. Teacher: What stores behavior? Student: `SwipeAction` model.
30. Teacher: What stores mutual match? Student: `Match` model.
31. Teacher: Why sorted match key? Student: Same pair always produces same unique key.
32. Teacher: How is chat created? Student: A match acts as the conversation.
33. Teacher: What is conversation ID? Student: MongoDB Match `_id`.
34. Teacher: Where are messages stored? Student: `messages` collection.
35. Teacher: Is chat realtime? Student: Yes, Socket.IO broadcasts `new_message`.
36. Teacher: Does REST chat also exist? Student: Yes, GET/POST `/api/messages/:matchId`.
37. Teacher: How does socket authenticate? Student: JWT in socket handshake auth.
38. Teacher: Can unmatched users read chat? Student: No, backend checks Match contains user.
39. Teacher: Are message attachments uploaded? Student: No, current attachment preview is local UI only.
40. Teacher: Where is scheduling UI? Student: `AvailabilityCalendar.jsx`.
41. Teacher: Where is session model? Student: `backend/models/Session.js`.
42. Teacher: Who creates a session? Student: A logged-in participant through `POST /api/sessions`.
43. Teacher: What is default session status? Student: `pending`.
44. Teacher: Who confirms? Student: The other person, not proposer.
45. Teacher: What happens after confirm? Student: Status becomes `confirmed`; calendar sync is attempted.
46. Teacher: Can teacher reschedule? Student: Yes, route allows only teacher.
47. Teacher: Can learner reschedule? Student: No, backend blocks it.
48. Teacher: How is time stored? Student: `scheduledAt` Date in MongoDB.
49. Teacher: Is availability enforced? Student: No, it is displayed but not validated.
50. Teacher: How is session completed? Student: Manual "Complete exchange" button.
51. Teacher: Is completion automatic? Student: No.
52. Teacher: Can completion happen before scheduled time? Student: Yes, current code does not check time.
53. Teacher: What happens on completion? Student: Session status becomes completed and two Activity records are created.
54. Teacher: What are activities for? Student: Profile timeline and achievements.
55. Teacher: Who can review? Student: Matched users can review each other.
56. Teacher: Can anyone review anyone? Student: No, backend requires a Match.
57. Teacher: Must session be completed to review? Student: No, that is a loophole.
58. Teacher: How is rating average calculated? Student: Backend averages all reviews for target user.
59. Teacher: Can I review same user twice? Student: It updates the existing review because unique index exists.
60. Teacher: Are notifications implemented? Student: Only preferences, not actual notifications.
61. Teacher: Where are notification prefs? Student: `User.notifPrefs`.
62. Teacher: Portfolio storage? Student: MongoDB Project documents via `mongoRoutes.js`.
63. Teacher: Are portfolio images uploaded? Student: No, URL fields only.
64. Teacher: What GitHub feature exists? Student: Client fetches repo metadata from GitHub API.
65. Teacher: What is availability model? Student: Recurring day/time slots on User.
66. Teacher: What is presence? Student: Polled status stored in Presence collection.
67. Teacher: Is presence true realtime? Student: No, it polls every 30 seconds.
68. Teacher: What is `apiRequest`? Student: Shared fetch wrapper adding headers/JWT and error handling.
69. Teacher: What does serializer do? Student: Converts Mongo documents to frontend-friendly IDs and fields.
70. Teacher: Why `select:false` for password? Student: Prevents password hash from being returned accidentally.
71. Teacher: What is CORS? Student: Backend setting that allows frontend origin to call API.
72. Teacher: What happens if Mongo URI missing? Student: Server starts but DB routes fail because connection not configured.
73. Teacher: Why use Mongoose? Student: Schema validation and MongoDB model methods.
74. Teacher: What is `timestamps:true`? Student: Mongoose adds `createdAt` and `updatedAt`.
75. Teacher: What is `populate`? Student: Replaces ObjectId refs with selected user data.
76. Teacher: What is `upsert`? Student: Update if found, insert if not found.
77. Teacher: Where is Google Calendar token stored? Student: `googlecredentials` encrypted fields.
78. Teacher: How are Google tokens encrypted? Student: AES-256-GCM in `tokenCrypto.js`.
79. Teacher: What is `JWT_SECRET`? Student: Secret key used to sign/verify app JWTs.
80. Teacher: Why use `FormData` for avatar? Student: It can send binary file data.
81. Teacher: Why not JSON for image? Student: JSON is for text; file upload needs multipart form.
82. Teacher: What is a limitation of local upload? Student: Not reliable on cloud deployments without persistent disk.
83. Teacher: What is `matchPercent`? Student: Compatibility score saved/displayed for recommendations.
84. Teacher: Does match count update? Student: `matchCount` field exists but route does not update it.
85. Teacher: What are swap requests? Student: Separate matched-user request model with statuses, but no main UI found.
86. Teacher: Which service is old Firebase code? Student: `src/services/profileService.js`.
87. Teacher: Is Firestore main database? Student: No, main active features use MongoDB/REST.
88. Teacher: Why is Firebase still present? Student: For Google sign-in; some old Firestore service code remains.
89. Teacher: What is frontend route for chat? Student: `/chat` mapped to `ChatPage`.
90. Teacher: What is protected route frontend? Student: There is no route guard component; pages redirect or backend rejects.
91. Teacher: How does app hydrate login? Student: `AuthContext` calls `/auth/me` if token exists.
92. Teacher: What happens on 401? Student: `apiRequest` clears token and throws error.
93. Teacher: What is `UserAvatar` for? Student: Displays avatar or fallback initials.
94. Teacher: Where are reviews shown? Student: Reviews section in `ProfilePage`.
95. Teacher: What creates activity timeline? Student: Completion route creates Activity documents; `ActivityTimeline` fetches them.
96. Teacher: Can session be cancelled? Student: Yes, DELETE marks it `cancelled`.
97. Teacher: Does delete remove session? Student: No, status changes to cancelled.
98. Teacher: What deployment issue exists? Student: Local uploads and local env secrets need production setup.
99. Teacher: Best improvement for reviews? Student: Allow reviews only after completed sessions.
100. Teacher: Best improvement for AI? Student: Replace rule scoring with model-backed recommendations or train from user behavior.

## 18. File-by-File Walkthrough

Frontend entry: `src/main.jsx` mounts React; `src/App.jsx` defines routes and wraps Theme/Auth providers; `src/context/AuthContext.jsx` owns auth state; `src/context/ThemeContext.jsx` owns light/dark theme.

Pages: `HomePage.jsx` shows landing and featured users; `LoginPage.jsx` handles login/register/Google auth; `SwipePage.jsx` loads recommendations and records swipes; `ChatPage.jsx` lists matches and messages; `ProfilePage.jsx` handles profile view/edit, image upload, reviews, skills, portfolio, activity, availability.

Services: `api.js` is the fetch/JWT wrapper; `authService.js` maps auth APIs; `userService.js` maps profile, avatar, swipe users, reviews; `matchService.js` maps likes/skips/matches and polls matches; `chatService.js` maps message REST helpers; `socketService.js` wraps Socket.IO; `calendarService.js` maps sessions and calendar; `profileFeatureService.js` maps availability, portfolio, activity, presence, skills, notification prefs; `profileService.js` is older Firebase/Firestore code and is not the main active path for ProfilePage.

Components: `Navbar` navigation/logout/theme; `SwipeCard` draggable user card; `UserAvatar` avatar fallback; `AvailabilityCalendar` active scheduling UI; `AvailabilityScheduler` older/simple scheduler component; `PortfolioShowcase` project CRUD; `ActivityTimeline` activity heatmap/timeline; `ProfileCompletion` completion checklist; `PresenceIndicator` status polling; `EnhancedSkillBadge` skill metadata/endorsement UI; `StarRating`, `SkillBadge`, `MatchPercentBadge` display helpers.

Backend entry/config: `backend/server.js` sets Express, CORS, static `/uploads`, routes, Socket.IO; `config/db.js` connects MongoDB; `config/firebaseAdmin.js` verifies Firebase Google tokens.

Backend routes: `auth.js` register/login/google/me/profile; `users.js` featured/swipe/profile/reviews; `matches.js` like/skip/match; `messages.js` REST chat; `sessions.js` scheduling lifecycle; `uploads.js` avatar upload; `mongoRoutes.js` availability/projects/activities/presence/skill-meta/notif prefs; `googleCalendar.js` calendar OAuth; `swapRequests.js` swap request workflow.

Backend models: `User`, `Like`, `SwipeAction`, `Match`, `Message`, `Session`, `Review`, `Activity`, `SwapRequest`, `GoogleCredential`, plus inline `Project`, `Presence`, `SkillMeta` in `mongoRoutes.js`.

Utilities/services: `matching.js` recommendation scoring; `serializers.js` shapes API output; `tokenCrypto.js` encrypts Google tokens; `chatSocket.js` realtime chat events; `googleOAuthService.js` and `googleCalendarService.js` handle Google Calendar.

Config/build: `package.json` frontend scripts/deps; `backend/package.json` backend deps; `vite.config.js` React dev/build config; `tailwind.config.js` Tailwind/DaisyUI design config; `.env.example` frontend API URLs; `README.md` run instructions; `firestore.rules` exists for Firebase/Firestore but main backend uses MongoDB.

## Things the student probably does NOT understand

JWT: Think of it as a signed ID card. The backend signs it at login. Later, the user shows it in the Authorization header. The backend checks the signature before trusting it.

Bcrypt: It turns a password into a one-way scrambled value. During login, bcrypt checks whether the typed password scrambles to the stored hash.

Multer upload: The browser cannot send an image as normal JSON. It sends a multipart form. Multer receives the file, chooses a folder and filename, saves it, and your database stores only the URL.

Rule-based matching: The project calls it AI, but it is more like a marksheet. Each compatibility reason gives points, then the backend sorts users by total marks.

Mutual match: A Like is one-sided. A Match is created only when both users have liked each other.

Socket.IO rooms: A room is like a private chat classroom named `match:<id>`. Only users in that match may join. When one sends a message, the server broadcasts to the room.

Session completion: The app does not magically know a class happened. It trusts a participant pressing "Complete exchange".

Reviews loophole: The backend checks that users matched, but not that they completed a session. So a matched pair can review early.

Mongo `populate`: IDs in one collection can point to documents in another. Populate replaces an ID with selected fields, like user name and avatar.

Duplicate project model confusion: `backend/models/Project.js` exists, but the active portfolio routes use an inline Project schema in `mongoRoutes.js`. In viva, say the active route uses the inline `Project` model from `mongoRoutes.js`.
