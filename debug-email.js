
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
    console.log('Testing Email Sending...');

    const config = {
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        },
        tls: {
            ciphers: 'SSLv3',
            rejectUnauthorized: false
        },
        requireTLS: true
    };

    console.log('Config:', {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.auth.user,
        pass: config.auth.pass ? '***' : 'MISSING'
    });

    const transporter = nodemailer.createTransport(config);

    try {
        console.log('Verifying connection...');
        await transporter.verify();
        console.log('Connection verified successfully');

        console.log('Sending test email...');
        const info = await transporter.sendMail({
            from: config.auth.user,
            to: 'infraestructura@megatlon.com.ar', // Send to self or configured infra email
            subject: 'Test Email from Megasys (Debug)',
            text: 'This is a test email to verify SMTP configuration.'
        });

        console.log('Email sent:', info.messageId);
        console.log('Response:', info.response);

    } catch (error) {
        console.error('Error:', error);
    }
}

testEmail();
