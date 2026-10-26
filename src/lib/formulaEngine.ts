// Formula engine for spreadsheet cells
// Supports: =SUM(A1:A10) =AVERAGE =MAX =MIN =COUNT =IF =ROUND =ABS =SQRT =POWER =CONCAT =LEN =UPPER =LOWER =TRIM =MEDIAN =PRODUCT =MOD =CEILING =FLOOR =A1+B1 arithmetic, cell refs, ranges

export type CellValue = string;

interface EvalContext {
  getCell: (ref: string) => string;
  grid: CellValue[][];
}

const COL_LETTERS = (n: number): string => {
  let s = "";
  n++;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

export const colLetter = COL_LETTERS;

export function parseRef(ref: string): { row: number; col: number } | null {
  const m = ref.match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return null;
  const letters = m[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { row: parseInt(m[2], 10) - 1, col: col - 1 };
}

export function makeRef(row: number, col: number): string {
  return `${COL_LETTERS(col)}${row + 1}`;
}

function parseRange(range: string): { start: string; end: string } | null {
  const parts = range.split(":");
  if (parts.length === 2) return { start: parts[0].trim(), end: parts[1].trim() };
  return null;
}

function getRangeValues(range: string, ctx: EvalContext): number[] {
  const parsed = parseRange(range);
  if (!parsed) {
    const v = parseFloat(ctx.getCell(parsed?.start ?? range));
    return isNaN(v) ? [] : [v];
  }
  const s = parseRef(parsed.start);
  const e = parseRef(parsed.end);
  if (!s || !e) return [];
  const minR = Math.min(s.row, e.row);
  const maxR = Math.max(s.row, e.row);
  const minC = Math.min(s.col, e.col);
  const maxC = Math.max(s.col, e.col);
  const vals: number[] = [];
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const ref = makeRef(r, c);
      const v = parseFloat(ctx.getCell(ref));
      if (!isNaN(v)) vals.push(v);
    }
  }
  return vals;
}

function getRangeCells(range: string, ctx: EvalContext): string[] {
  const parsed = parseRange(range);
  if (!parsed) return [ctx.getCell(range)];
  const s = parseRef(parsed.start);
  const e = parseRef(parsed.end);
  if (!s || !e) return [];
  const minR = Math.min(s.row, e.row);
  const maxR = Math.max(s.row, e.row);
  const minC = Math.min(s.col, e.col);
  const maxC = Math.max(s.col, e.col);
  const vals: string[] = [];
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      vals.push(ctx.getCell(makeRef(r, c)));
    }
  }
  return vals;
}

// Tokenizer for formula expressions
type Token =
  | { type: "num"; value: number }
  | { type: "ref"; value: string }
  | { type: "op"; value: string }
  | { type: "func"; value: string }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "comma" }
  | { type: "string"; value: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === " " || ch === "\t") { i++; continue; }
    if (ch === '"') {
      let s = "";
      i++;
      while (i < expr.length && expr[i] !== '"') { s += expr[i]; i++; }
      i++;
      tokens.push({ type: "string", value: s });
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let s = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) { s += expr[i]; i++; }
      tokens.push({ type: "num", value: parseFloat(s) });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let s = "";
      while (i < expr.length && /[A-Za-z0-9_:]/.test(expr[i])) { s += expr[i]; i++; }
      // Check if it's a function call (followed by '(')
      if (expr[i] === "(") {
        tokens.push({ type: "func", value: s.toUpperCase() });
      } else {
        // It's a cell reference
        tokens.push({ type: "ref", value: s.toUpperCase() });
      }
      continue;
    }
    if (ch === "(") { tokens.push({ type: "lparen" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "rparen" }); i++; continue; }
    if (ch === ",") { tokens.push({ type: "comma" }); i++; continue; }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "^" || ch === "%") {
      // Check for <= >= <> = < >
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    if (ch === "<" || ch === ">" || ch === "=") {
      let s = ch;
      if (expr[i + 1] === "=") { s += "="; i++; }
      if (expr[i + 1] === ">" && ch === "<") { s += ">"; i++; }
      tokens.push({ type: "op", value: s });
      i++;
      continue;
    }
    if (ch === "&") {
      tokens.push({ type: "op", value: "&" });
      i++;
      continue;
    }
    i++; // skip unknown
  }
  return tokens;
}

// Parser with operator precedence and function calls
type ExprNode =
  | { type: "num"; value: number }
  | { type: "string"; value: string }
  | { type: "ref"; value: string }
  | { type: "range"; start: string; end: string }
  | { type: "op"; op: string; left: ExprNode; right: ExprNode }
  | { type: "unary"; op: string; operand: ExprNode }
  | { type: "func"; name: string; args: ExprNode[] };

class Parser {
  tokens: Token[];
  pos = 0;
  constructor(tokens: Token[]) { this.tokens = tokens; }
  peek(): Token | null { return this.tokens[this.pos] ?? null; }
  next(): Token { return this.tokens[this.pos++]; }

  parse(): ExprNode {
    return this.parseComparison();
  }

  parseComparison(): ExprNode {
    let left = this.parseConcat();
    while (this.peek()?.type === "op" && ["<", ">", "<=", ">=", "=", "<>"].includes((this.peek() as { value: string }).value)) {
      const op = (this.next() as { value: string }).value;
      const right = this.parseConcat();
      left = { type: "op", op, left, right };
    }
    return left;
  }

  parseConcat(): ExprNode {
    let left = this.parseAddSub();
    while (this.peek()?.type === "op" && (this.peek() as { value: string }).value === "&") {
      this.next();
      const right = this.parseAddSub();
      left = { type: "op", op: "&", left, right };
    }
    return left;
  }

  parseAddSub(): ExprNode {
    let left = this.parseMulDiv();
    while (this.peek()?.type === "op" && ["+", "-"].includes((this.peek() as { value: string }).value)) {
      const op = (this.next() as { value: string }).value;
      const right = this.parseMulDiv();
      left = { type: "op", op, left, right };
    }
    return left;
  }

  parseMulDiv(): ExprNode {
    let left = this.parsePower();
    while (this.peek()?.type === "op" && ["*", "/", "%"].includes((this.peek() as { value: string }).value)) {
      const op = (this.next() as { value: string }).value;
      const right = this.parsePower();
      left = { type: "op", op, left, right };
    }
    return left;
  }

  parsePower(): ExprNode {
    let left = this.parseUnary();
    while (this.peek()?.type === "op" && (this.peek() as { value: string }).value === "^") {
      this.next();
      const right = this.parseUnary();
      left = { type: "op", op: "^", left, right };
    }
    return left;
  }

  parseUnary(): ExprNode {
    if (this.peek()?.type === "op" && (this.peek() as { value: string }).value === "-") {
      this.next();
      return { type: "unary", op: "-", operand: this.parseUnary() };
    }
    if (this.peek()?.type === "op" && (this.peek() as { value: string }).value === "+") {
      this.next();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  parsePrimary(): ExprNode {
    const tok = this.peek();
    if (!tok) return { type: "num", value: 0 };
    if (tok.type === "num") { this.next(); return { type: "num", value: tok.value }; }
    if (tok.type === "string") { this.next(); return { type: "string", value: tok.value }; }
    if (tok.type === "ref") {
      this.next();
      // Check for range (A1:B2)
      if (this.peek()?.type === "op" && (this.peek() as { value: string }).value === ":") {
        // Actually, colon is not a token we produce — ranges are handled inside function args
        // But let's handle it anyway
      }
      return { type: "ref", value: tok.value };
    }
    if (tok.type === "func") {
      const name = (this.next() as { value: string }).value;
      this.next(); // consume (
      const args: ExprNode[] = [];
      if (this.peek()?.type !== "rparen") {
        args.push(this.parseArg());
        while (this.peek()?.type === "comma") {
          this.next();
          args.push(this.parseArg());
        }
      }
      if (this.peek()?.type === "rparen") this.next();
      return { type: "func", name, args };
    }
    if (tok.type === "lparen") {
      this.next();
      const node = this.parse();
      if (this.peek()?.type === "rparen") this.next();
      return node;
    }
    this.next();
    return { type: "num", value: 0 };
  }

  parseArg(): ExprNode {
    // An argument can be a range like A1:B2
    const left = this.parse();
    if (this.peek()?.type === "op" && (this.peek() as { value: string }).value === ":") {
      this.next();
      const right = this.parse();
      // Construct a range node from two refs
      if (left.type === "ref" && right.type === "ref") {
        return { type: "range", start: left.value, end: right.value };
      }
    }
    return left;
  }
}

function evalNode(node: ExprNode, ctx: EvalContext): number | string {
  switch (node.type) {
    case "num": return node.value;
    case "string": return node.value;
    case "ref": {
      const v = ctx.getCell(node.value);
      const n = parseFloat(v);
      return isNaN(n) ? v : n;
    }
    case "range": return ""; // ranges handled in functions
    case "unary": {
      const v = evalNode(node.operand, ctx);
      const n = typeof v === "number" ? v : parseFloat(v);
      return node.op === "-" ? -n : n;
    }
    case "op": {
      const l = evalNode(node.left, ctx);
      const r = evalNode(node.right, ctx);
      switch (node.op) {
        case "+": { return (toNum(l) + toNum(r)); }
        case "-": { return (toNum(l) - toNum(r)); }
        case "*": { return (toNum(l) * toNum(r)); }
        case "/": { const rv = toNum(r); return rv === 0 ? 0 : toNum(l) / rv; }
        case "%": { return toNum(l) % toNum(r); }
        case "^": { return Math.pow(toNum(l), toNum(r)); }
        case "&": { return String(l) + String(r); }
        case "=": { return l === r ? 1 : 0; }
        case "<>": { return l !== r ? 1 : 0; }
        case "<": { return toNum(l) < toNum(r) ? 1 : 0; }
        case ">": { return toNum(l) > toNum(r) ? 1 : 0; }
        case "<=": { return toNum(l) <= toNum(r) ? 1 : 0; }
        case ">=": { return toNum(l) >= toNum(r) ? 1 : 0; }
      }
      return 0;
    }
    case "func": {
      return evalFunc(node.name, node.args, ctx);
    }
  }
  return 0;
}

function toNum(v: number | string): number {
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function getArgNumbers(args: ExprNode[], ctx: EvalContext): number[] {
  const vals: number[] = [];
  for (const arg of args) {
    if (arg.type === "range") {
      const range = `${arg.start}:${arg.end}`;
      vals.push(...getRangeValues(range, ctx));
    } else {
      const v = evalNode(arg, ctx);
      vals.push(toNum(v));
    }
  }
  return vals;
}

function getArgStrings(args: ExprNode[], ctx: EvalContext): string[] {
  const vals: string[] = [];
  for (const arg of args) {
    if (arg.type === "range") {
      const range = `${arg.start}:${arg.end}`;
      vals.push(...getRangeCells(range, ctx));
    } else {
      const v = evalNode(arg, ctx);
      vals.push(String(v));
    }
  }
  return vals;
}

function evalFunc(name: string, args: ExprNode[], ctx: EvalContext): number | string {
  const nums = () => getArgNumbers(args, ctx);
  const strs = () => getArgStrings(args, ctx);

  switch (name) {
    case "SUM": return nums().reduce((a, b) => a + b, 0);
    case "AVERAGE": case "AVERAGEA": { const n = nums(); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0; }
    case "MEDIAN": {
      const n = nums().sort((a, b) => a - b);
      if (!n.length) return 0;
      const mid = Math.floor(n.length / 2);
      return n.length % 2 ? n[mid] : (n[mid - 1] + n[mid]) / 2;
    }
    case "MAX": return nums().length ? Math.max(...nums()) : 0;
    case "MIN": return nums().length ? Math.min(...nums()) : 0;
    case "COUNT": return nums().filter((v) => !isNaN(v)).length;
    case "COUNTA": return strs().filter((v) => v !== "").length;
    case "PRODUCT": return nums().reduce((a, b) => a * b, 1);
    case "MOD": { const n = nums(); return n.length >= 2 ? (n[0] % n[1]) : 0; }
    case "ROUND": { const n = nums(); return n.length >= 2 ? Math.round(n[0] * Math.pow(10, n[1])) / Math.pow(10, n[1]) : 0; }
    case "ROUNDUP": { const n = nums(); return n.length >= 2 ? Math.ceil(n[0] * Math.pow(10, n[1])) / Math.pow(10, n[1]) : 0; }
    case "ROUNDDOWN": { const n = nums(); return n.length >= 2 ? Math.floor(n[0] * Math.pow(10, n[1])) / Math.pow(10, n[1]) : 0; }
    case "CEILING": { const n = nums(); return n.length >= 2 ? Math.ceil(n[0] / n[1]) * n[1] : 0; }
    case "FLOOR": { const n = nums(); return n.length >= 2 ? Math.floor(n[0] / n[1]) * n[1] : 0; }
    case "ABS": { const n = nums(); return n.length ? Math.abs(n[0]) : 0; }
    case "SQRT": { const n = nums(); return n.length ? Math.sqrt(n[0]) : 0; }
    case "POWER": { const n = nums(); return n.length >= 2 ? Math.pow(n[0], n[1]) : 0; }
    case "EXP": { const n = nums(); return n.length ? Math.exp(n[0]) : 0; }
    case "LN": { const n = nums(); return n.length ? Math.log(n[0]) : 0; }
    case "LOG": { const n = nums(); return n.length ? Math.log10(n[0]) : 0; }
    case "LOG10": { const n = nums(); return n.length ? Math.log10(n[0]) : 0; }
    case "SIN": { const n = nums(); return n.length ? Math.sin(n[0]) : 0; }
    case "COS": { const n = nums(); return n.length ? Math.cos(n[0]) : 0; }
    case "TAN": { const n = nums(); return n.length ? Math.tan(n[0]) : 0; }
    case "PI": return Math.PI;
    case "RAND": return Math.random();
    case "RANDBETWEEN": { const n = nums(); return n.length >= 2 ? Math.floor(Math.random() * (n[1] - n[0] + 1)) + n[0] : 0; }
    case "INT": { const n = nums(); return n.length ? Math.floor(n[0]) : 0; }
    case "SIGN": { const n = nums(); return n.length ? Math.sign(n[0]) : 0; }
    case "CONCAT": case "CONCATENATE": return strs().join("");
    case "LEN": { const s = strs(); return s.length ? s[0].length : 0; }
    case "UPPER": { const s = strs(); return s.length ? s[0].toUpperCase() : ""; }
    case "LOWER": { const s = strs(); return s.length ? s[0].toLowerCase() : ""; }
    case "TRIM": { const s = strs(); return s.length ? s[0].trim() : ""; }
    case "PROPER": { const s = strs(); return s.length ? s[0].replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()) : ""; }
    case "LEFT": { const s = strs(); const n = nums(); return s.length ? s[0].substring(0, n[1] ?? n[0]) : ""; }
    case "RIGHT": { const s = strs(); const n = nums(); return s.length ? s[0].substring(s[0].length - (n[1] ?? n[0])) : ""; }
    case "MID": { const s = strs(); const n = nums(); return s.length && n.length >= 2 ? s[0].substring(n[1] - 1, n[1] - 1 + n[2]) : ""; }
    case "REPT": { const s = strs(); const n = nums(); return s.length ? s[0].repeat(n[1] ?? n[0]) : ""; }
    case "SUBSTITUTE": { const s = strs(); return s.length >= 3 ? s[0].split(s[1]).join(s[2]) : s[0] ?? ""; }
    case "TEXT": { const s = strs(); const n = nums(); return s.length ? s[0] : String(n[0] ?? ""); }
    case "VALUE": { const s = strs(); return s.length ? toNum(s[0]) : 0; }
    case "IF": {
      if (args.length < 2) return "";
      const cond = evalNode(args[0], ctx);
      const isTrue = typeof cond === "number" ? cond !== 0 : cond !== "" && cond !== "false";
      if (isTrue) return evalNode(args[1], ctx);
      return args[2] ? evalNode(args[2], ctx) : "";
    }
    case "IFERROR": {
      if (args.length < 2) return "";
      try {
        const v = evalNode(args[0], ctx);
        return v;
      } catch {
        return evalNode(args[1], ctx);
      }
    }
    case "AND": {
      const vals = args.map((a) => evalNode(a, ctx));
      return vals.every((v) => (typeof v === "number" ? v !== 0 : v === "true")) ? 1 : 0;
    }
    case "OR": {
      const vals = args.map((a) => evalNode(a, ctx));
      return vals.some((v) => (typeof v === "number" ? v !== 0 : v === "true")) ? 1 : 0;
    }
    case "NOT": {
      const v = evalNode(args[0], ctx);
      return (typeof v === "number" ? v === 0 : v === "false") ? 1 : 0;
    }
    case "TRUE": return 1;
    case "FALSE": return 0;
    case "NOW": return new Date().toLocaleString();
    case "TODAY": return new Date().toLocaleDateString();
    case "YEAR": { const s = strs(); const d = new Date(s[0]); return isNaN(d.getTime()) ? 0 : d.getFullYear(); }
    case "MONTH": { const s = strs(); const d = new Date(s[0]); return isNaN(d.getTime()) ? 0 : d.getMonth() + 1; }
    case "DAY": { const s = strs(); const d = new Date(s[0]); return isNaN(d.getTime()) ? 0 : d.getDate(); }
    case "WEEKDAY": { const s = strs(); const d = new Date(s[0]); return isNaN(d.getTime()) ? 0 : d.getDay() + 1; }
    case "DATEDIF": {
      const s = strs();
      if (s.length < 2) return 0;
      const d1 = new Date(s[0]);
      const d2 = new Date(s[1]);
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
      const unit = strs()[2]?.toLowerCase() ?? "d";
      const diff = d2.getTime() - d1.getTime();
      if (unit === "d") return Math.floor(diff / 86400000);
      if (unit === "m") return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      if (unit === "y") return d2.getFullYear() - d1.getFullYear();
      return Math.floor(diff / 86400000);
    }
    case "RANK": {
      const n = nums();
      if (n.length < 1) return 0;
      const val = n[0];
      const range = getArgNumbers(args.slice(1), ctx).sort((a, b) => b - a);
      const idx = range.indexOf(val);
      return idx >= 0 ? idx + 1 : 0;
    }
    case "LARGE": {
      const n = nums();
      if (n.length < 2) return 0;
      const k = n[n.length - 1];
      const vals = n.slice(0, -1).sort((a, b) => b - a);
      return vals[k - 1] ?? 0;
    }
    case "SMALL": {
      const n = nums();
      if (n.length < 2) return 0;
      const k = n[n.length - 1];
      const vals = n.slice(0, -1).sort((a, b) => a - b);
      return vals[k - 1] ?? 0;
    }
    case "STDEV": case "STDEVP": {
      const n = nums();
      if (n.length < 2) return 0;
      const mean = n.reduce((a, b) => a + b, 0) / n.length;
      const variance = n.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (name === "STDEVP" ? n.length : n.length - 1);
      return Math.sqrt(variance);
    }
    case "VAR": case "VARP": {
      const n = nums();
      if (n.length < 2) return 0;
      const mean = n.reduce((a, b) => a + b, 0) / n.length;
      const variance = n.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (name === "VARP" ? n.length : n.length - 1);
      return variance;
    }
    case "PERCENTILE": {
      const n = nums();
      if (n.length < 2) return 0;
      const p = n[n.length - 1];
      const sorted = n.slice(0, -1).sort((a, b) => a - b);
      const idx = p * (sorted.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    }
    default: return `#NAME?`;
  }
}

// Detect circular references
function findRefs(expr: string): string[] {
  const refs: string[] = [];
  const tokens = tokenize(expr);
  for (const t of tokens) {
    if (t.type === "ref") refs.push(t.value);
  }
  return refs;
}

export function evaluateCell(rawValue: string, grid: CellValue[][], visited: Set<string> = new Set()): string {
  if (!rawValue || !rawValue.startsWith("=")) return rawValue;

  const expr = rawValue.slice(1);

  // Detect circular reference
  const refs = findRefs(expr);
  for (const ref of refs) {
    if (visited.has(ref)) return "#CIRC!";
  }

  const ctx: EvalContext = {
    getCell: (ref: string) => {
      const parsed = parseRef(ref);
      if (!parsed) return "";
      if (parsed.row < 0 || parsed.col < 0) return "";
      if (parsed.row >= grid.length || parsed.col >= (grid[0]?.length ?? 0)) return "0";
      const cellVal = grid[parsed.row][parsed.col];
      if (!cellVal || !cellVal.startsWith("=")) return cellVal || "";
      // Recursively evaluate
      return evaluateCell(cellVal, new Set(visited).add(ref), grid);
    },
    grid,
  };

  try {
    const tokens = tokenize(expr);
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const result = evalNode(ast, ctx);
    if (typeof result === "number") {
      if (isNaN(result)) return "#NUM!";
      if (!isFinite(result)) return "#DIV/0!";
      // Format: avoid floating point artifacts
      const rounded = Math.round(result * 1e10) / 1e10;
      return String(rounded);
    }
    return result;
  } catch {
    return "#ERROR!";
  }
}

// Check if a cell contains a formula
export function isFormula(value: string): boolean {
  return value.startsWith("=");
}

// Get all formula functions for the formula bar help
export const FORMULA_FUNCTIONS: { name: string; desc: string; example: string }[] = [
  { name: "SUM", desc: "Soma de um intervalo", example: "=SUM(A1:A10)" },
  { name: "AVERAGE", desc: "Média de um intervalo", example: "=AVERAGE(A1:A10)" },
  { name: "MEDIAN", desc: "Mediana de um intervalo", example: "=MEDIAN(A1:A10)" },
  { name: "MAX", desc: "Maior valor", example: "=MAX(A1:A10)" },
  { name: "MIN", desc: "Menor valor", example: "=MIN(A1:A10)" },
  { name: "COUNT", desc: "Conta números", example: "=COUNT(A1:A10)" },
  { name: "COUNTA", desc: "Conta não-vazios", example: "=COUNTA(A1:A10)" },
  { name: "PRODUCT", desc: "Produto de valores", example: "=PRODUCT(A1:A5)" },
  { name: "IF", desc: "Condicional", example: '=IF(A1>10,"Sim","Não")' },
  { name: "IFERROR", desc: "Valor alternativo em erro", example: "=IFERROR(A1/B1,0)" },
  { name: "AND", desc: "E lógico", example: "=AND(A1>0,B1>0)" },
  { name: "OR", desc: "OU lógico", example: "=OR(A1>0,B1>0)" },
  { name: "NOT", desc: "Negação lógica", example: "=NOT(A1>0)" },
  { name: "ROUND", desc: "Arredondar", example: "=ROUND(A1,2)" },
  { name: "ROUNDUP", desc: "Arredondar para cima", example: "=ROUNDUP(A1,2)" },
  { name: "ROUNDDOWN", desc: "Arredondar para baixo", example: "=ROUNDDOWN(A1,2)" },
  { name: "CEILING", desc: "Arredondar para múltiplo", example: "=CEILING(A1,5)" },
  { name: "FLOOR", desc: "Arredondar para múltiplo (baixo)", example: "=FLOOR(A1,5)" },
  { name: "ABS", desc: "Valor absoluto", example: "=ABS(A1)" },
  { name: "SQRT", desc: "Raiz quadrada", example: "=SQRT(A1)" },
  { name: "POWER", desc: "Potência", example: "=POWER(A1,2)" },
  { name: "EXP", desc: "Exponencial", example: "=EXP(A1)" },
  { name: "LN", desc: "Logaritmo natural", example: "=LN(A1)" },
  { name: "LOG", desc: "Logaritmo base 10", example: "=LOG(A1)" },
  { name: "SIN", desc: "Seno", example: "=SIN(A1)" },
  { name: "COS", desc: "Cosseno", example: "=COS(A1)" },
  { name: "TAN", desc: "Tangente", example: "=TAN(A1)" },
  { name: "PI", desc: "Constante Pi", example: "=PI()" },
  { name: "MOD", desc: "Resto da divisão", example: "=MOD(A1,2)" },
  { name: "INT", desc: "Parte inteira", example: "=INT(A1)" },
  { name: "SIGN", desc: "Sinal do número", example: "=SIGN(A1)" },
  { name: "RAND", desc: "Número aleatório", example: "=RAND()" },
  { name: "RANDBETWEEN", desc: "Aleatório entre min e max", example: "=RANDBETWEEN(1,100)" },
  { name: "STDEV", desc: "Desvio padrão (amostra)", example: "=STDEV(A1:A10)" },
  { name: "STDEVP", desc: "Desvio padrão (população)", example: "=STDEVP(A1:A10)" },
  { name: "VAR", desc: "Variância (amostra)", example: "=VAR(A1:A10)" },
  { name: "VARP", desc: "Variância (população)", example: "=VARP(A1:A10)" },
  { name: "PERCENTILE", desc: "Percentil", example: "=PERCENTILE(A1:A10,0.5)" },
  { name: "RANK", desc: "Posição no ranking", example: "=RANK(A1,A1:A10)" },
  { name: "LARGE", desc: "K-ésimo maior", example: "=LARGE(A1:A10,2)" },
  { name: "SMALL", desc: "K-ésimo menor", example: "=SMALL(A1:A10,2)" },
  { name: "CONCAT", desc: "Concatenar textos", example: '=CONCAT(A1," ",B1)' },
  { name: "CONCATENATE", desc: "Concatenar textos", example: '=CONCATENATE(A1,B1)' },
  { name: "LEN", desc: "Tamanho do texto", example: "=LEN(A1)" },
  { name: "UPPER", desc: "Texto em maiúsculas", example: "=UPPER(A1)" },
  { name: "LOWER", desc: "Texto em minúsculas", example: "=LOWER(A1)" },
  { name: "TRIM", desc: "Remover espaços extras", example: "=TRIM(A1)" },
  { name: "PROPER", desc: "Primeira letra maiúscula", example: "=PROPER(A1)" },
  { name: "LEFT", desc: "Texto da esquerda", example: "=LEFT(A1,3)" },
  { name: "RIGHT", desc: "Texto da direita", example: "=RIGHT(A1,3)" },
  { name: "MID", desc: "Texto do meio", example: "=MID(A1,2,3)" },
  { name: "REPT", desc: "Repetir texto", example: '=REPT("ab",3)' },
  { name: "SUBSTITUTE", desc: "Substituir texto", example: '=SUBSTITUTE(A1,"a","b")' },
  { name: "VALUE", desc: "Converter texto em número", example: "=VALUE(A1)" },
  { name: "TODAY", desc: "Data atual", example: "=TODAY()" },
  { name: "NOW", desc: "Data e hora atuais", example: "=NOW()" },
  { name: "YEAR", desc: "Ano de uma data", example: "=YEAR(A1)" },
  { name: "MONTH", desc: "Mês de uma data", example: "=MONTH(A1)" },
  { name: "DAY", desc: "Dia de uma data", example: "=DAY(A1)" },
  { name: "WEEKDAY", desc: "Dia da semana", example: "=WEEKDAY(A1)" },
  { name: "DATEDIF", desc: "Diferença entre datas", example: '=DATEDIF(A1,B1,"d")' },
];
