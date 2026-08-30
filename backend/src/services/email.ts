import nodemailer from 'nodemailer';
import axios from 'axios';

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) {
    return transporter;
  }

  let user = process.env.ETHEREAL_USER;
  let pass = process.env.ETHEREAL_PASSWORD;
  let host = process.env.ETHEREAL_HOST || 'smtp.ethereal.email';
  let port = parseInt(process.env.ETHEREAL_PORT || '587', 10);

  if (!user || !pass) {
    console.log('No Ethereal Email SMTP credentials found. Auto-generating test account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      user = testAccount.user;
      pass = testAccount.pass;
      host = testAccount.smtp.host;
      port = testAccount.smtp.port;
      console.log('----------------------------------------------------');
      console.log('AUTO-GENERATED ETHEREAL EMAIL ACCOUNT CREDENTIALS:');
      console.log(`User: ${user}`);
      console.log(`Pass: ${pass}`);
      console.log(`Host: ${host}`);
      console.log(`Port: ${port}`);
      console.log(`Web Link: ${testAccount.web}`);
      console.log('----------------------------------------------------');
    } catch (err) {
      console.error('Failed to auto-generate Ethereal email account:', err);
      throw err;
    }
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000, // 10 seconds timeout
    socketTimeout: 10000,
    greetingTimeout: 10000,
  });

  return transporter;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  body: string;
  senderName: string;
  senderEmail: string;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string;
  error?: string;
}

export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.EMAIL_FROM_OVERRIDE || options.senderEmail;

  // 1. Resend HTTP API Transport
  if (resendApiKey) {
    console.log(`[Email Service] Sending email to ${options.to} via Resend HTTP API...`);
    try {
      const response = await axios.post(
        'https://api.resend.com/emails',
        {
          from: `"${options.senderName}" <${fromEmail}>`,
          to: [options.to],
          subject: options.subject,
          html: options.body,
          text: options.body.replace(/<[^>]*>/g, ''),
        },
        {
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 seconds timeout
        }
      );
      
      return {
        success: true,
        messageId: response.data?.id,
      };
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      console.error('[Email Service] Resend API Error:', errMsg);
      return {
        success: false,
        error: `Resend API Error: ${errMsg}`,
      };
    }
  }

  // 2. SendGrid HTTP API Transport
  if (sendgridApiKey) {
    console.log(`[Email Service] Sending email to ${options.to} via SendGrid HTTP API...`);
    try {
      const response = await axios.post(
        'https://api.sendgrid.com/v3/mail/send',
        {
          personalizations: [
            {
              to: [{ email: options.to }],
            },
          ],
          from: {
            email: fromEmail,
            name: options.senderName,
          },
          subject: options.subject,
          content: [
            {
              type: 'text/html',
              value: options.body,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${sendgridApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 seconds timeout
        }
      );

      const messageId = response.headers['x-message-id'] || `sg-${Date.now()}`;
      return {
        success: true,
        messageId,
      };
    } catch (error: any) {
      const errMsg = JSON.stringify(error.response?.data?.errors || error.response?.data || error.message);
      console.error('[Email Service] SendGrid API Error:', errMsg);
      return {
        success: false,
        error: `SendGrid API Error: ${errMsg}`,
      };
    }
  }

  // 3. Fallback to Nodemailer Ethereal SMTP
  try {
    const client = await getTransporter();
    
    const info = await client.sendMail({
      from: `"${options.senderName}" <${options.senderEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.body, // Send html email body
      text: options.body.replace(/<[^>]*>/g, ''), // Strip tags for plain text fallback
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
    };
  } catch (error: any) {
    console.error('Error sending email through Nodemailer:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred while sending email',
    };
  }
}

