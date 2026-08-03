const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

const makeResponsePdf = ({ test, candidate, questions, attempt }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.on("error", reject);
  doc.fillColor("#3f5eea").fontSize(20).text("ExamPlat Result Summary");
  doc.moveDown(0.4).fillColor("#475569").fontSize(10).text(`Assessment: ${test.title}`);
  doc.text(`Test ID: ${test.testId}`);
  doc.text(`Candidate: ${candidate.hallTicketNo}`);
  doc.moveDown().fillColor("#0f172a").fontSize(14).text(attempt ? "Response record" : "Attempt status");
  doc.moveDown(0.4).fontSize(10).fillColor("#475569");
  if (!attempt) {
    doc.text("This candidate did not attempt the examination. No responses were recorded.");
  } else {
    doc.text(`Score: ${attempt.score ?? "Pending evaluation"} / ${attempt.totalMarks ?? "—"}`);
    doc.text(`Attempt: ${attempt.attemptNumber ?? 1}`);
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
  const SENDER_NAME = "ExamPlat Result";
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
    subject: `${test.title} - ${attempted ? "Your result" : "Attendance update"}`,
    text: emailBody,
    attachments: [{ filename: `${test.testId}-${candidate.hallTicketNo}-response.pdf`, content: pdf, contentType: "application/pdf" }],
  });
};

module.exports = { makeResponsePdf, sendResultEmail };