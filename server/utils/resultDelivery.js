const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

const makeResponsePdf = ({ test, candidate, questions }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.on("error", reject);
  doc.fillColor("#3f5eea").fontSize(20).text("ExamPlat Result Summary");
  doc.moveDown(0.4).fillColor("#475569").fontSize(10).text(`Assessment: ${test.title}`);
  doc.text(`Test ID: ${test.testId}`);
  doc.text(`Candidate: ${candidate.hallTicketNo}`);
  doc.moveDown().fillColor("#0f172a").fontSize(14).text(candidate.attemptsUsed > 0 ? "Response record" : "Attempt status");
  doc.moveDown(0.4).fontSize(10).fillColor("#475569");
  if (!candidate.attemptsUsed) {
    doc.text("This candidate did not attempt the examination. No responses were recorded.");
  } else {
    doc.text(`Score: ${candidate.score ?? "Pending evaluation"}`);
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

const sendResultEmail = async ({ recipient, test, candidate, pdf }) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
    throw new Error("Email delivery is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM.");
  }
  const transporter = nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT || 587), secure: Number(SMTP_PORT) === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  const attempted = candidate.attemptsUsed > 0;
  await transporter.sendMail({
    from: EMAIL_FROM,
    to: recipient,
    subject: `${test.title} - ${attempted ? "Your result" : "Attendance update"}`,
    text: attempted ? `Your result for ${test.title} is now available. Score: ${candidate.score ?? "Pending evaluation"}. Your response record is attached.` : `You did not attempt ${test.title}. A PDF attendance and response record is attached.`,
    attachments: [{ filename: `${test.testId}-${candidate.hallTicketNo}-response.pdf`, content: pdf, contentType: "application/pdf" }],
  });
};

module.exports = { makeResponsePdf, sendResultEmail };
