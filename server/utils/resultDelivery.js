const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const { attemptBrowser } = require("./browserDetection");

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const makeResponsePdf = ({ test, candidate, questions, attempt }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.on("error", reject);
  doc.fillColor("#3f5eea").fontSize(20).text("ExamPlat Result Summary");
  doc.moveDown(0.4).fillColor("#475569").fontSize(10).text(`Assessment: ${test.title}`);
  doc.text(`Test ID: ${test.testId || test.finalExamId}`);
  doc.text(`Candidate: ${candidate.hallTicketNo}`);
  doc.moveDown().fillColor("#0f172a").fontSize(14).text(attempt ? "Response record" : "Attempt status");
  doc.moveDown(0.4).fontSize(10).fillColor("#475569");
  if (!attempt) {
    doc.text("This candidate did not attempt the examination. No responses were recorded.");
  } else {
    doc.text(`Score: ${attempt.score ?? "Pending evaluation"} / ${attempt.totalMarks ?? "—"}`);
    doc.text(`Attempt: ${attempt.attemptNumber ?? 1}`);
    doc.text(`Browser: ${attemptBrowser(attempt) || "—"}`);
    doc.text(`Correct: ${attempt.correctAnswers ?? 0} · Wrong: ${attempt.wrongAnswers ?? 0} · Unanswered: ${attempt.unanswered ?? 0}`);
    doc.text(`Percentage: ${attempt.percentage ?? 0}%`);
    doc.moveDown();
    const responseMap = new Map((candidate.responses || []).map((response) => [String(response.questionId), response]));
    questions.forEach((question, index) => {
      const response = responseMap.get(String(question._id));
      doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold").text(`${index + 1}. ${question.questionText}`);
      doc.font("Helvetica").fillColor("#475569").text(response && Number.isInteger(response.selectedOption) ? `Response: ${question.options[response.selectedOption]}` : "Response: Not answered");
      doc.moveDown(0.6);
    });
  }
  doc.moveDown().fillColor("#94a3b8").fontSize(8).text(`Generated ${new Date().toLocaleString()} by ExamPlat.`, { align: "right" });
  doc.end();
});

const sendResultEmail = async ({ recipient, test, candidate, pdf, attempt, studentName }) => {
  // Support both BREVO_* and SMTP_* env var naming conventions
  const SMTP_HOST = process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST;
  const SMTP_PORT = process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT;
  const SMTP_USER = process.env.BREVO_SMTP_USER || process.env.SMTP_USER;
  const SMTP_PASS = process.env.BREVO_SMTP_PASS || process.env.SMTP_PASS;
  const EMAIL_FROM = process.env.BREVO_FROM_EMAIL || process.env.EMAIL_FROM;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
    throw new Error("Email delivery is not configured. Set BREVO_SMTP_HOST, BREVO_SMTP_USER, BREVO_SMTP_PASS, and BREVO_FROM_EMAIL.");
  }
  // Format the sender with a display name: "ExamPlat <noreply.linksphere@gmail.com>"
  const SENDER_NAME = "ExamPlat Admin";
  const fromAddress = EMAIL_FROM.includes("<") ? EMAIL_FROM : `${SENDER_NAME} <${EMAIL_FROM}>`;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const attempted = Boolean(attempt);
  const name = studentName || candidate.hallTicketNo;
  const score = attempt ? `${attempt.score ?? "Pending evaluation"} / ${attempt.totalMarks ?? "—"}` : "Not attempted";
  const attemptNumber = attempt ? attempt.attemptNumber ?? 1 : "—";
  const browser = attempt ? attemptBrowser(attempt) || "—" : "—";
  const remarks = attempt
    ? `Correct: ${attempt.correctAnswers ?? 0}, Wrong: ${attempt.wrongAnswers ?? 0}, Unanswered: ${attempt.unanswered ?? 0}, Percentage: ${attempt.percentage ?? 0}%`
    : "Candidate did not attempt the examination.";

  const emailBody = [
    `Dear ${name},`,
    ``,
    `Your result for ${test.title} is now available.`,
    ``,
    `Name: ${name}`,
    `Hall Ticket No: ${candidate.hallTicketNo}`,
    `Exam Name: ${test.title}`,
    `Attempt Number: ${attemptNumber}`,
    `Browser: ${browser}`,
    `Score: ${score}`,
    `Remarks: ${remarks}`,
    ``,
    `For further details, please visit our website.`,
    ``,
    `Regards,`,
    `ExamPlat Team`,
  ].join("\n");

  await transporter.sendMail({
    from: fromAddress,
    to: recipient,
    cc: "mounvikkarnati@gmail.com",
    subject: `${test.title} - ${attempted ? "Your result" : "Attendance update"}`,
    text: emailBody,
    attachments: [{ filename: `${test.testId || test.finalExamId}-${candidate.hallTicketNo}-response.pdf`, content: pdf, contentType: "application/pdf" }],
  });
};

const sendResultReleaseEmail = async ({ recipient, test, studentName }) => {
  const SMTP_HOST = process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST;
  const SMTP_PORT = process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT;
  const SMTP_USER = process.env.BREVO_SMTP_USER || process.env.SMTP_USER;
  const SMTP_PASS = process.env.BREVO_SMTP_PASS || process.env.SMTP_PASS;
  const EMAIL_FROM = process.env.BREVO_FROM_EMAIL || process.env.EMAIL_FROM;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
    throw new Error("Email delivery is not configured. Set BREVO_SMTP_HOST, BREVO_SMTP_USER, BREVO_SMTP_PASS, and BREVO_FROM_EMAIL.");
  }
  const SENDER_NAME = "ExamPlat Admin";
  const fromAddress = EMAIL_FROM.includes("<") ? EMAIL_FROM : `${SENDER_NAME} <${EMAIL_FROM}>`;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const name = studentName || "Candidate";
  const examDate = test.defaultStartAt ? new Date(test.defaultStartAt).toLocaleString() : "—";
  const examId = test.finalExamId || test.testId || "—";
  const resultUrl = "https://examplatstudent.vercel.app/final-result";
  const emailBody = [
    `Dear ${name},`,
    ``,
    `The results for ${test.title} are now available.`,
    ``,
    `Exam Name: ${test.title}`,
    `Test ID: ${examId}`,
    `Exam Date: ${examDate}`,
    ``,
    `View your result: ${resultUrl}`,
    ``,
    `Best regards,`,
    `ExamPlat Team`,
  ].join("\n");

  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(test.title);
  const safeExamId = escapeHtml(examId);
  const safeExamDate = escapeHtml(examDate);
  const html = `
    <div style="margin:0;padding:32px 16px;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5eaf2;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 32px;background:#173b72;color:#ffffff;">
          <div style="font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#c8dcff;">ExamPlat</div>
          <div style="margin-top:8px;font-size:24px;line-height:1.3;font-weight:bold;">Your results are ready</div>
        </td></tr>
        <tr><td style="padding:30px 32px 12px;font-size:16px;line-height:1.6;">
          <p style="margin:0 0 12px;">Dear ${safeName},</p>
          <p style="margin:0 0 22px;color:#475569;">The results for <strong style="color:#172033;">${safeTitle}</strong> have been released. You can view your result securely using the button below.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;border-collapse:collapse;background:#f8fafc;border:1px solid #e5eaf2;border-radius:8px;">
            <tr><td style="padding:12px 16px;border-bottom:1px solid #e5eaf2;color:#64748b;font-size:13px;width:125px;">Exam name</td><td style="padding:12px 16px;border-bottom:1px solid #e5eaf2;font-size:14px;font-weight:bold;">${safeTitle}</td></tr>
            <tr><td style="padding:12px 16px;border-bottom:1px solid #e5eaf2;color:#64748b;font-size:13px;">Test ID</td><td style="padding:12px 16px;border-bottom:1px solid #e5eaf2;font-size:14px;">${safeExamId}</td></tr>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px;">Exam date</td><td style="padding:12px 16px;font-size:14px;">${safeExamDate}</td></tr>
          </table>
          <p style="margin:0 0 24px;text-align:center;"><a href="${resultUrl}" style="display:inline-block;padding:13px 24px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;border-radius:6px;">View your result</a></p>
          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">If the button doesn’t work, copy and paste this link into your browser:<br><a href="${resultUrl}" style="color:#2563eb;word-break:break-all;">${resultUrl}</a></p>
        </td></tr>
        <tr><td style="padding:20px 32px 24px;border-top:1px solid #edf0f5;color:#64748b;font-size:13px;line-height:1.6;">Best regards,<br><strong style="color:#334155;">ExamPlat Team</strong></td></tr>
      </table>
    </div>`;

  await transporter.sendMail({
    from: fromAddress,
    to: recipient,
    subject: `${test.title} - Results released`,
    text: emailBody,
    html,
  });
};

module.exports = { makeResponsePdf, sendResultEmail, sendResultReleaseEmail };
