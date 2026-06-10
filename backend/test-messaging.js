import mongoose from 'mongoose';
import User from './models/User.js';
import Match from './models/Match.js';
import Message from './models/Message.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/skillswap';

async function testMessaging() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all users
    const users = await User.find().limit(5);
    console.log(`Found ${users.length} users`);
    
    if (users.length < 2) {
      console.log('Not enough users to create a match');
      await mongoose.disconnect();
      return;
    }

    const user1 = users[0];
    const user2 = users[1];
    
    console.log(`User 1: ${user1._id} - ${user1.name}`);
    console.log(`User 2: ${user2._id} - ${user2.name}`);

    // Check if a match already exists
    const existingMatch = await Match.findOne({
      users: { $all: [user1._id, user2._id] }
    });

    let match;
    if (existingMatch) {
      match = existingMatch;
      console.log(`Match already exists: ${match._id}`);
    } else {
      // Create a new match
      const users_sorted = [user1._id, user2._id].sort((a, b) =>
        a.toString().localeCompare(b.toString())
      );
      
      match = await Match.create({
        users: users_sorted,
        key: `${users_sorted[0]}_${users_sorted[1]}`,
        status: 'matched',
        matchPercent: 75
      });
      console.log(`Created new match: ${match._id}`);
    }

    // Try to send a test message
    const testMessage = await Message.create({
      match: match._id,
      sender: user1._id,
      text: 'Hello from test script!'
    });
    console.log(`Created test message: ${testMessage._id}`);
    console.log(`Message content: "${testMessage.text}"`);

    // Update match with message preview
    await Match.findByIdAndUpdate(match._id, {
      lastMessageText: testMessage.text,
      lastMessageSender: testMessage.sender,
      lastMessageAt: testMessage.createdAt
    });
    console.log('Updated match with message preview');

    // List all messages for this match
    const messages = await Message.find({ match: match._id });
    console.log(`Match has ${messages.length} messages`);
    messages.forEach(msg => {
      console.log(`  - [${msg.sender}]: ${msg.text}`);
    });

    console.log('\n=== MATCH DETAILS ===');
    console.log(`Match ID: ${match._id}`);
    console.log(`Users: ${match.users.join(', ')}`);
    console.log(`Last Message: "${match.lastMessageText}"`);
    console.log('=====================\n');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testMessaging();
