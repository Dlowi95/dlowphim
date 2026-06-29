const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const mongoUri = 'mongodb+srv://dailoi:dailoi0905@dailoi.f7gntdr.mongodb.net/dlowphim?appName=dailoi';

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
