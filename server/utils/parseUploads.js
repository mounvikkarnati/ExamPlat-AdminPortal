const XLSX = require("xlsx");

/**
 * Parses an uploaded question bank file (.xlsx or .json) into a normalized array:
 * { questionText, options: [4 strings], correctOption: 0-3, subject, topic }
 * Returns { questions, errors } where errors is a line-numbered list of problems (FR-A-04).
 * Does NOT throw on bad rows - collects errors and lets the caller decide (Section 4.1).
 */
function parseQuestionFile(file) {
  const isJson = file.originalname.toLowerCase().endsWith(".json");
  let rawRows = [];

  if (isJson) {
    try {
      const parsed = JSON.parse(file.buffer.toString("utf-8"));
      rawRows = Array.isArray(parsed) ? parsed : parsed.questions || [];
    } catch (e) {
      return { questions: [], errors: [`File is not valid JSON: ${e.message}`] };
    }
  } else {
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }

  const questions = [];
  const errors = [];
  const seen = new Set();

  rawRows.forEach((row, idx) => {
    const lineNo = idx + 2; // account for header row in spreadsheets / 1-index
    const questionText = String(row.questionText || row.question || "").trim();
    const options = [
      row.option1 ?? row.optionA ?? (row.options && row.options[0]),
      row.option2 ?? row.optionB ?? (row.options && row.options[1]),
      row.option3 ?? row.optionC ?? (row.options && row.options[2]),
      row.option4 ?? row.optionD ?? (row.options && row.options[3]),
    ].map((o) => (o === undefined || o === null ? "" : String(o).trim()));

    let correctOption = row.correctOption;
    if (typeof correctOption === "string") {
      const map = { A: 0, B: 1, C: 2, D: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
      correctOption = map[correctOption.toUpperCase()] ?? Number(correctOption);
    }

    const subject = String(row.subject || row.topic || "").trim();
    const topic = String(row.topic || "").trim();

    if (!questionText) {
      errors.push(`Row ${lineNo}: missing question text`);
      return;
    }
    if (options.some((o) => !o)) {
      errors.push(`Row ${lineNo}: one or more options are empty`);
      return;
    }
    if (
      correctOption === undefined ||
      correctOption === null ||
      Number.isNaN(correctOption) ||
      correctOption < 0 ||
      correctOption > 3
    ) {
      errors.push(`Row ${lineNo}: correctOption must identify exactly one valid option (A-D or 0-3)`);
      return;
    }

    const dupKey = questionText.toLowerCase();
    if (seen.has(dupKey)) {
      errors.push(`Row ${lineNo}: duplicate question text ("${questionText.slice(0, 40)}...")`);
      return;
    }
    seen.add(dupKey);

    questions.push({ questionText, options, correctOption: Number(correctOption), subject, topic });
  });

  return { questions, errors };
}

/**
 * Parses the Allowed Candidates Excel sheet (Section 4.3).
 * Expected columns: hallTicketNo (required), dob (optional, e.g. if Admin Portal is the source of truth)
 */
function parseCandidateFile(file) {
  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const candidates = [];
  const errors = [];
  const seen = new Set();

  rows.forEach((row, idx) => {
    const lineNo = idx + 2;
    const hallTicketNo = String(row.hallTicketNo || row.HallTicketNo || row["Hall Ticket No"] || "").trim();
    const dobRaw = row.dob || row.DOB || row["Date of Birth"] || "";

    if (!hallTicketNo) {
      errors.push(`Row ${lineNo}: missing Hall Ticket No.`);
      return;
    }
    if (seen.has(hallTicketNo)) {
      errors.push(`Row ${lineNo}: duplicate Hall Ticket No. (${hallTicketNo})`);
      return;
    }
    seen.add(hallTicketNo);

    let dob = null;
    if (dobRaw) {
      const parsedDate = new Date(dobRaw);
      dob = Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }

    candidates.push({ hallTicketNo, dob });
  });

  return { candidates, errors };
}

module.exports = { parseQuestionFile, parseCandidateFile };
