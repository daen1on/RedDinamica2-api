'use strict'

const nodemailer = require('nodemailer');
const process = require('process');
const path = require('path');
const mail = require('./mail');

let transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    tls: { rejectUnauthorized: false }, 
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }
});
// verify connection configuration
transporter.verify(function(error, success) {
    if (error) {
      console.log(error);
    } else {
      console.log("Server is ready to take our messages");
    }
  });

let mailOptions = function (subject, recipients, message) {
    let imagePath = path.join(__dirname, '../client/browser/assets/images/');
    
    return {
        from: `RedDinámica <${process.env.EMAIL_HOST_USER}>`,
        to: recipients,
        subject: subject,
        html: mail.mailTemplate(message),
        attachments: [
            {
                filename: 'RDLogo.png',
                path: imagePath+'RDLogo.png',
                cid: 'logo'
            }
        ]
    };
}

exports.sendMail = function (subject, recipients, message) {

    let emailData = mailOptions(subject, recipients, message);
    
    transporter.sendMail(emailData, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });

    transporter.close();
};