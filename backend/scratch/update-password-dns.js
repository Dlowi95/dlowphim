const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const mongoUri = 'mongodb+srv://dailoi:dailoi0905@dailoi.f7gntdr.mongodb.net/dlowphim?appName=dailoi';

async function run() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const UserSchema = new mongoose.Schema({
      email: String,
      password: String,
      role: String,
    }, { collection: 'users' });

    const User = mongoose.model('User', UserSchema);

    // Hash password '123456'
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt);

    // Update test@gmail.com password to hashed '123456'
    const result = await User.updateOne(
      { email: 'test@gmail.com' },
      { $set: { password: hashedPassword, role: 'admin' } }
    );

    console.log('Update result:', result);

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
