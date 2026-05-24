export function csvCell(value: string | number | boolean | null | undefined) {
  const stringValue = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll('"', '""')}"`;
}

export function csvRows(rows: Array<Array<string | number | boolean | null | undefined>>) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function csvResponse(filename: string, rows: Array<Array<string | number | boolean | null | undefined>>) {
  return new Response(`${csvRows(rows)}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
