const express = require("express");
const userRouter = require("./user");
const accountRouter = require("./account");
const otpRouter = require("./otp");
const router = express.Router();


const cors = require("cors");

const app = express();

app.use(cors({
  origin: "http://localhost:5174",
  credentials: true,
}));

app.use(express.json());

// routes below

router.use("/user", userRouter);
router.use("/account", accountRouter);
router.use("/otp", otpRouter);

module.exports = router;
