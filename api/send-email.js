// api/send-email.js
import { Resend } from "resend";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end("Method Not Allowed");
  }
  const { to, subject, text, html } = req.body;

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
}