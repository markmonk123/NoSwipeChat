# Singles Connect - Location-Based Dating Chatroom App

A mobile app for singles to connect with verified profiles in their city through real-time chat. Features Facebook authentication, location-based matching, and free city-based chatrooms.

## Features

- **Facebook Verification**: Secure login with Facebook OAuth2
- **Location-Based Matching**: Connect with singles in your city
- **City Chatrooms**: Free chat separated by city with closest city matching
- **Verified Profiles**: All profiles verified through Facebook
- **Real-Time Messaging**: Instant chat using Socket.io
- **Nearby Users Discovery**: See who's nearby and their profiles
- **AI Personality Profiling**: RoBERTa-powered social-data digestion into 73-point profile vectors

## Project Structure

```
GoogleApp/
├── backend/                 # Node.js Express server
│   ├── src/
│   │   ├── config/         # Configuration files (database, etc.)
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Auth, error handling
│   │   ├── models/         # Database schemas
│   │   ├── routes/         # API endpoints
│   │   └── server.js       # Main server entry point
│   ├── package.json
│   └── .env.example
├── frontend/               # React Native Expo app
│   ├── screens/           # Screen components
│   ├── utils/             # Utility functions
│   ├── App.js             # Main app component
│   ├── app.json           # Expo configuration
│   └── package.json
└── README.md
```

## Tech Stack

### Backend
- **Node.js** with Express
- **Socket.io** for real-time messaging
- **MongoDB** for data storage
- **Passport.js** for Facebook OAuth2
- **JWT** for authentication

### Frontend
- **React Native** with Expo
- **React Navigation** for routing
- **Expo Location** for GPS
- **Expo Facebook** for authentication
- **Socket.io Client** for real-time chat
- **Axios** for HTTP requests

## Prerequisites

- Node.js v16+ and npm
- MongoDB running locally or connection URI
- Facebook Developer App (for OAuth)
- Expo CLI: `npm install -g expo-cli`

## Setup Instructions

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Configure environment variables:
   - Add your MongoDB URI
   - Add Facebook App ID and Secret
   - Add JWT Secret
   - Update URLs as needed

5. Start the server:
   ```bash
   npm run dev
   ```

Server will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd ../frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Facebook App ID in `LoginScreen.js`:
   - Replace `YOUR_FACEBOOK_APP_ID` with your actual App ID

4. Start the Expo development server:
   ```bash
   npm start
   ```

5. Run on iOS or Android:
   - iOS: Press `i`
   - Android: Press `a`
   - Web: Press `w`

## API Endpoints

### Authentication
- `POST /auth/facebook/callback` - Facebook OAuth callback

### Chat
- `GET /chat/city/:city` - Get messages for a city
- `POST /chat/send` - Send a message

### Users
- `GET /users/profile` - Get current user profile
- `PUT /users/profile` - Update user profile
- `GET /users/nearby` - Get nearby verified users

## AI Personality Pipeline (RoBERTa + Hugging Face)

- The embeddings service loads a Hugging Face RoBERTa model (`roberta-base` by default).
- Model artifacts are downloaded during Docker image build so runtime can stay offline on internal networks.
- New social data submissions trigger automatic personality refresh into:
  - `personalityProfile.vector73` (73-point system)
  - `personalityProfile.vector35` (derived for visual orb rendering)

### Configure model source

Set `HF_MODEL_NAME` in your environment before build if you want a different RoBERTa-family model:

```bash
HF_MODEL_NAME=roberta-base
```

### Rebuild and run

```bash
docker compose build embeddings
docker compose up -d embeddings backend nginx
```

## Socket.io Events

### Client → Server
- `join-room` - Join a city's chat room
- `send-message` - Send a message to the room
- `disconnect` - Leave the room

### Server → Client
- `user-joined` - New user joined the room
- `receive-message` - New message received
- `user-left` - User left the room

## Security Features

- Facebook OAuth2 verification
- JWT token authentication
- Password hashing with bcryptjs
- CORS protection
- Location privacy (closest city only shown)
- Geospatial indexing for location queries

## Database Models

### User
- Facebook ID, name, email
- Location (Point geometry for geospatial queries)
- Profile info (age, gender, bio, interests)
- Verification status
- Preferred search distance

### Message
- User reference
- City name
- Message content
- Timestamp (auto-expires after 7 days)

### ProfileVerification
- User reference
- Facebook verification status
- Photo verification status

## Deployment

### Backend (Node.js)
Suitable for deployment on:
- Heroku
- AWS EC2
- DigitalOcean
- Railway
- Render

### Frontend (React Native)
- Build for iOS: `expo build:ios`
- Build for Android: `expo build:android`
- Deploy to App Store / Google Play

## Environment Variables

### Backend (.env)
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/singles-chatroom
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_CALLBACK_URL=http://localhost:5000/auth/facebook/callback
JWT_SECRET=your_jwt_secret_key
FRONTEND_URL=http://localhost:3000
MAX_DISTANCE_KM=50
```

## Development Notes

- **Location Privacy**: The app shows only the closest city, not exact coordinates in chat
- **Verification**: All users must authenticate with Facebook
- **Free Chat**: All city-based chatrooms are free
- **Real-time**: Socket.io handles live messaging and user presence
- **Scalability**: Consider Redis for Socket.io adapter in production

## Future Enhancements

- Direct messaging between verified users
- User blocking/reporting
- Photo verification system
- In-app payment for Advertisers
- Video chat capabilities
- Push notifications
- User profiles with photo gallery
- Matching algorithms

## License

MIT

## Support

For issues or questions, please refer to the documentation or create an issue in the repository.
