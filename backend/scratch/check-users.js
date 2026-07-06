const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoUri = process.env.MONGO_URI;

async function run() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const UserSchema = new mongoose.Schema({
      email: String,
      displayName: String,
      role: String,
    }, { collection: 'users' });

    const User = mongoose.model('User', UserSchema);

    const users = await User.find({}).lean();
    console.log('--- List of Users ---');
    users.forEach(u => {
      console.log(`ID: ${u._id} | Email: ${u.email} | Name: ${u.displayName} | Role: ${u.role}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
