export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false, closedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted) { quoted = false; closedQuote = true; }
      else if (!cell && !closedQuote) quoted = true;
      else throw new Error("Unexpected quote in CSV field");
    } else if (!quoted && (char === "," || char === "\n" || char === "\r")) {
      row.push(cell); cell = ""; closedQuote = false;
      if (char !== ",") {
        if (char === "\r" && text[i + 1] === "\n") i++;
        rows.push(row); row = [];
      }
    } else {
      if (closedQuote) throw new Error("Unexpected text after CSV closing quote");
      cell += char;
    }
  }
  if (quoted) throw new Error("Unterminated CSV field");
  if (cell || row.length || closedQuote) { row.push(cell); rows.push(row); }
  const [headers, ...records] = rows;
  if (!headers || headers.some((header) => !header.trim()) || new Set(headers).size !== headers.length) throw new Error("Invalid CSV headers");
  return { headers, records: records.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}`);
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  }) };
}

export function formatCsv(headers, records) {
  const escape = (value) => /[",\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
  return [headers, ...records.map((record) => headers.map((header) => String(record[header] ?? "")))].map((row) => row.map(escape).join(",")).join("\n") + "\n";
}
