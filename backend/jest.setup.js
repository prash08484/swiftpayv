const mongoose = require("mongoose");

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });

  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(async () => {
  await mongoose.disconnect();
  console.error.mockRestore();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
