import express from 'express';
import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON body
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

// POST endpoint for sending email (replacing Vercel serverless function)
app.post('/api/send-email', async (req, res) => {
  const { to, subject, text, html } = req.body;

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "RESEND_API_KEY is not defined in .env" });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev", // Must use this for unverified domains
      to,
      subject,
      text,
      html,
    });

    if (error) return res.status(400).json({ error });
    return res.status(200).json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running!`);
  console.log(`Test your portfolio at: http://localhost:${PORT}`);
});
