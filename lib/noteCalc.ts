export type CalcEntry = {
  label: string;
  key: string;
  aliases: string[];
  raw: string;
  value: number | null;
  expression: string | null;
  isUnknown: boolean;
  lineIndex: number;
};

export type CalcResult = {
  entries: CalcEntry[];
  variables: Record<string, number>;
  computed: Record<string, number>;
  totals: { sum: number; firstMinusRest: number | null };
  errors: string[];
};

/** Allow letters, digits, underscore, hyphen */
const VAR_NAME = "[a-zA-Z_][\\w-]*";

function normalizeKey(name: string) {
  return name.trim().toLowerCase().replace(/^@/, "");
}

function slugify(label: string) {
  return (
    label
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/[^a-z0-9\u0980-\u09FF]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "item"
  );
}

function extractNumber(text: string): number | null {
  const cleaned = text.replace(/,/g, "").trim();
  if (/@/.test(cleaned)) return null;
  const m = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*(?:taka|tk|bdt|৳)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

function isExpression(rhs: string): boolean {
  const t = rhs.trim();
  if (!t || t === "?") return false;
  if (/^-?\d+(\.\d+)?(\s*(taka|tk|bdt|৳))?$/i.test(t.replace(/,/g, ""))) return false;
  return /[+\-*/()]/.test(t) || new RegExp(`@${VAR_NAME}`).test(t);
}

/**
 * Evaluate + - * / ( ) with @vars (hyphens allowed) and bare aliases.
 */
export function evaluateExpression(expr: string, vars: Record<string, number>): number | null {
  let normalized = expr.trim();

  // Replace @var-names (longest-first). Hyphenated names supported.
  const atNames = Object.keys(vars)
    .filter((k) => k.length > 0)
    .sort((a, b) => b.length - a.length);

  // End of @name: stop before ops, or before "-@" (e.g. @T-@A), but not before
  // hyphenated continuation (@Total-Budget).
  const afterVar = "(?!(?:[\\w]|-(?=[\\w])))";

  for (const name of atNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`@${escaped}${afterVar}`, "gi");
    normalized = normalized.replace(re, ` ${vars[name]} `);
  }

  // Bare multi-char aliases only (avoid matching letter `c` inside words)
  for (const name of atNames) {
    if (name.length < 2) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![\\w@-])${escaped}${afterVar}`, "gi");
    normalized = normalized.replace(re, ` ${vars[name]} `);
  }

  normalized = normalized.replace(/\s+/g, "");

  if (!normalized || !/^[\d+\-*/().]+$/.test(normalized)) {
    throw new Error(`Invalid expression: ${expr}`);
  }

  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict"; return (${normalized});`)();
  return typeof result === "number" && Number.isFinite(result) ? result : null;
}

export function htmlToPlainLines(html: string): string[] {
  if (typeof document === "undefined") {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .split(/\r?\n/)
      .map((l) => l.replace(/\u00a0/g, " ").trim())
      .filter(Boolean);
  }
  const div = document.createElement("div");
  div.innerHTML = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n");
  const text = div.innerText || div.textContent || "";
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00a0/g, " ").trim())
    .filter((l) => l.length > 0);
}

function registerVar(vars: Record<string, number>, keys: string[], value: number) {
  for (const k of keys) {
    const key = normalizeKey(k);
    if (key) vars[key] = value;
  }
}

/**
 * Supported syntax:
 * - `@budget = 65000` or `@Total-Budget=65000`
 * - `Total Budget @T = 65000`  (label + short alias)
 * - `@Left = @T - @A - @g`  (+ - * / and parentheses)
 * - `Left = ?`
 * - `= 10 * (2 + 3)`
 */
export function analyzeNoteCalculations(htmlOrText: string): CalcResult {
  const lines = htmlToPlainLines(htmlOrText);
  const entries: CalcEntry[] = [];
  const errors: string[] = [];
  const variables: Record<string, number> = {};
  const computed: Record<string, number> = {};

  lines.forEach((line, lineIndex) => {
    // Standalone: = expr
    const standalone = line.match(/^=\s*(.+)$/);
    if (standalone) {
      entries.push({
        label: `Line ${lineIndex + 1}`,
        key: `expr_${lineIndex}`,
        aliases: [],
        raw: line,
        value: null,
        expression: standalone[1].trim(),
        isUnknown: true,
        lineIndex,
      });
      return;
    }

    // @name = rhs  (hyphens allowed, optional spaces)
    const atAssign = line.match(new RegExp(`^@(${VAR_NAME})\\s*=\\s*(.*)$`));
    if (atAssign) {
      const key = normalizeKey(atAssign[1]);
      const rhs = (atAssign[2] || "").trim();
      const aliases = [key, slugify(key)];

      if (!rhs || rhs === "?") {
        entries.push({
          label: `@${key}`,
          key,
          aliases,
          raw: line,
          value: null,
          expression: null,
          isUnknown: true,
          lineIndex,
        });
        return;
      }

      if (isExpression(rhs)) {
        entries.push({
          label: `@${key}`,
          key,
          aliases,
          raw: line,
          value: null,
          expression: rhs,
          isUnknown: true,
          lineIndex,
        });
      } else {
        const num = extractNumber(rhs);
        entries.push({
          label: `@${key}`,
          key,
          aliases,
          raw: line,
          value: num,
          expression: null,
          isUnknown: num === null,
          lineIndex,
        });
        if (num !== null) registerVar(variables, aliases, num);
      }
      return;
    }

    // Label @alias = rhs   e.g. Total-Budget @T = 65000
    const aliasAssign = line.match(
      new RegExp(`^(.+?)\\s+@(${VAR_NAME})\\s*=\\s*(.*)$`)
    );
    if (aliasAssign) {
      const label = aliasAssign[1].trim();
      const alias = normalizeKey(aliasAssign[2]);
      const rhs = (aliasAssign[3] || "").trim();
      const key = alias;
      const aliases = [alias, slugify(label), slugify(alias)];

      if (!rhs || rhs === "?") {
        entries.push({
          label: `${label} @${alias}`,
          key,
          aliases,
          raw: line,
          value: null,
          expression: null,
          isUnknown: true,
          lineIndex,
        });
        return;
      }

      if (isExpression(rhs)) {
        entries.push({
          label: `${label} @${alias}`,
          key,
          aliases,
          raw: line,
          value: null,
          expression: rhs,
          isUnknown: true,
          lineIndex,
        });
      } else {
        const num = extractNumber(rhs);
        entries.push({
          label: `${label} @${alias}`,
          key,
          aliases,
          raw: line,
          value: num,
          expression: null,
          isUnknown: num === null,
          lineIndex,
        });
        if (num !== null) registerVar(variables, aliases, num);
      }
      return;
    }

    // Label = rhs
    const labelAssign = line.match(/^(.+?)\s*=\s*(.*)$/);
    if (labelAssign) {
      const label = labelAssign[1].trim();
      const rhs = (labelAssign[2] || "").trim();
      if (!label || label.length > 100) return;

      const key = slugify(label);
      const aliases = [key, normalizeKey(label)];

      if (!rhs || rhs === "?") {
        entries.push({
          label,
          key,
          aliases,
          raw: line,
          value: null,
          expression: null,
          isUnknown: true,
          lineIndex,
        });
        return;
      }

      if (isExpression(rhs)) {
        entries.push({
          label,
          key,
          aliases,
          raw: line,
          value: null,
          expression: rhs,
          isUnknown: true,
          lineIndex,
        });
      } else {
        const num = extractNumber(rhs);
        entries.push({
          label,
          key,
          aliases,
          raw: line,
          value: num,
          expression: null,
          isUnknown: num === null,
          lineIndex,
        });
        if (num !== null) registerVar(variables, aliases, num);
      }
    }
  });

  // Resolve expressions (multi-pass)
  for (let pass = 0; pass < 12; pass++) {
    let progressed = false;
    for (const entry of entries) {
      if (entry.value !== null || !entry.expression) continue;
      try {
        const scope = { ...variables, ...computed };
        const val = evaluateExpression(entry.expression, scope);
        if (val !== null) {
          entry.value = val;
          entry.isUnknown = false;
          registerVar(computed, [entry.key, ...entry.aliases], val);
          registerVar(variables, [entry.key, ...entry.aliases], val);
          progressed = true;
        }
      } catch (e) {
        if (pass === 11) {
          errors.push(e instanceof Error ? e.message : `Failed: ${entry.label}`);
        }
      }
    }
    if (!progressed) break;
  }

  const numericValues = entries
    .filter((e) => e.value !== null && !e.expression)
    .map((e) => e.value as number);
  const sum = numericValues.reduce((a, b) => a + b, 0);
  let firstMinusRest: number | null = null;
  if (numericValues.length >= 2) {
    firstMinusRest = numericValues[0] - numericValues.slice(1).reduce((a, b) => a + b, 0);
  }

  for (const entry of entries) {
    if (entry.isUnknown && entry.value === null && !entry.expression && firstMinusRest !== null) {
      entry.value = firstMinusRest;
      entry.isUnknown = false;
      registerVar(computed, [entry.key, ...entry.aliases], firstMinusRest);
      registerVar(variables, [entry.key, ...entry.aliases], firstMinusRest);
    }
  }

  return { entries, variables, computed, totals: { sum, firstMinusRest }, errors };
}

export function formatCalcNumber(n: number) {
  return n.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });
}

export function buildCalcSummary(result: CalcResult): string {
  const lines: string[] = ["📊 Calculation summary"];
  for (const e of result.entries) {
    if (e.value !== null) {
      lines.push(`${e.label} = ${formatCalcNumber(e.value)}`);
    } else {
      lines.push(`${e.label} = ?`);
    }
  }
  if (result.totals.firstMinusRest !== null) {
    lines.push(`Remaining (first − rest) = ${formatCalcNumber(result.totals.firstMinusRest)}`);
  }
  lines.push(`Sum of assigned values = ${formatCalcNumber(result.totals.sum)}`);
  return lines.join("\n");
}

export function applyCalculatedValuesToHtml(html: string, result: CalcResult): string {
  const lines = htmlToPlainLines(html);
  if (lines.length === 0) return html;

  const byLine = new Map(result.entries.map((e) => [e.lineIndex, e]));
  const next = lines.map((line, index) => {
    const entry = byLine.get(index);
    if (!entry || entry.value === null) return line;
    if (entry.expression || /\?\s*$/.test(line) || /=\s*$/.test(line)) {
      // Keep original left side, replace RHS
      const left = line.includes("=") ? line.slice(0, line.indexOf("=")).trim() : entry.label;
      return `${left} = ${formatCalcNumber(entry.value)}`;
    }
    return line;
  });

  return next.map((l) => `<p>${escapeHtml(l)}</p>`).join("");
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
