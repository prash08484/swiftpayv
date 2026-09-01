const nodemailer = require("nodemailer");
require("dotenv").config();

const mailSender = async (email, title, body) => {
  try {
    // Create a Transporter to send emails

    var smtpConfig = {
      service: process.env.EMAIL_SERVICE || "gmail",
      port: 465,
      secure: true, // use SSL for port 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    };

    let transporter = nodemailer.createTransport(smtpConfig);

    // Send emails to users
    let info = await transporter.sendMail({
      from: "SwiftPay Payments",
      to: email,
      subject: title,
      html: body,
    });
    return info;
  } catch (error) {
    console.log("Error" + error.message);
  }
};
module.exports = mailSender;
