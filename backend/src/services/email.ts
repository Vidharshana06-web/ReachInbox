import nodemailer from 'nodemailer';

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
