const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const config = require("../config");

const dbURI = config.MONGODB_URI;

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose;
  await mongoose.connect(dbURI, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log("Database connected successfully");
  return mongoose;
}

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  username: {
    type: String,
    required: true,
    minLength: 3,
    maxLength: 30,
    trim: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
});

const AccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  balance: {
    type: Number,
    required: true,
    default: config.INITIAL_SIMULATED_BALANCE,
  },
});

UserSchema.methods.createHash = async function (plainTextPassword) {
  const saltRounds = 10;
  const salt = await bcrypt.genSalt(saltRounds);
  return await bcrypt.hash(plainTextPassword, salt);
};

UserSchema.methods.validatePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    index: true,
  },
  otpHash: {
    type: String,
    required: true,
  },
  used: {
    type: Boolean,
    default: false,
  },
  attemptCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

otpSchema.index({ email: 1, createdAt: -1 });

const Account = mongoose.model("account", AccountSchema);
const User = mongoose.model("users", UserSchema);
const OTP = mongoose.model("OTP", otpSchema);

module.exports = {
  connectDatabase,
  User,
  Account,
  OTP,
};
