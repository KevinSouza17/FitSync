import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, X, Save, Loader2, Table2, Pencil,
  Copy, Clipboard, Undo2, Redo2, Search, ArrowUpDown,
  Eraser, Sigma, ChevronDown, FunctionSquare,
  Rows3, Columns3, ArrowDownToLine, ArrowUpToLine,
  ArrowRightToLine, ArrowLeftToLine,
  Trash, Minus,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import type { ClientSpreadsheet } from "../lib/types";
import { cn } from "../lib/utils";
import {
  evaluateCell, isFormula, colLetter, makeRef, parseRef,
  FORMULA_FUNCTIONS,
} from "../lib/formulaEngine";

type Cell = { v: string };
type Grid = Cell[][];

const EMPTY_GRID = (): Grid => {
  const rows: Grid = [];
  for (let r = 0; r < 8; r++) rows.push(Array.from({ length: 6 }, () => ({ v: "" })));
  return rows;
};

const DIET_TEMPLATE = (): Grid => {
  const headers = ["Refeição", "Alimento", "Qtd (g)", "Calorias", "Proteína (g)", "Carbo (g)"];
  const meals = ["Café da manhã", "Almoço", "Lanche", "Jantar", "Ceia"];
  const grid: Grid = [headers.map((h) => ({ v: h }))];
  meals.forEach((m) => grid.push([{ v: m }, ...Array.from({ length: 5 }, () => ({ v: "" }))]));
  grid.push(Array.from({ length: 6 }, () => ({ v: "" })));
  // Add a totals row with formula
  grid.push([
    { v: "Total" }, { v: "" }, { v: "=SUM(C2:C6)" }, { v: "=SUM(D2:D6)" }, { v: "=SUM(E2:E6)" }, { v: "=SUM(F2:F6)" },
  ]);
  return grid;
};

const WORKOUT_TEMPLATE = (): Grid => {
  const headers = ["Dia", "Exercício", "Séries", "Reps", "Carga (kg)", "Descanso (s)"];
  const days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
  const grid: Grid = [headers.map((h) => ({ v: h }))];
  days.forEach((d) => grid.push([{ v: d }, ...Array.from({ length: 5 }, () => ({ v: "" }))]));
  grid.push(Array.from({ length: 6 }, () => ({ v: "" })));
  grid.push([
    { v: "Total" }, { v: "" }, { v: "=SUM(C2:C6)" }, { v: "=SUM(D2:D6)" }, { v: "=SUM(E2:E6)" }, { v: "=SUM(F2:F6)" },
  ]);
  return grid;
};

function gridFromData(data: unknown): Grid {
  if (!Array.isArray(data) || data.length === 0) return EMPTY_GRID();
  return (data as unknown as Grid).map((row) =>
    Array.isArray(row) ? row.map((c) => (c && typeof c === "object" && "v" in c ? c : { v: String(c ?? "") })) : []
  );
}

function gridToData(grid: Grid): string[][] {
  return grid.map((row) => row.map((c) => c.v));
}

function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.map((c) => ({ v: c.v })));
}

interface Props {
  clientId: string;
  clientName: string;
}

export function ClientSpreadsheets({ clientId, clientName }: Props) {
  const { user } = useAuth();
  const [sheets, setSheets] = useState<ClientSpreadsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSheet, setEditingSheet] = useState<ClientSpreadsheet | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [sheetType, setSheetType] = useState<"diet" | "workout">("diet");
  const [grid, setGrid] = useState<Grid>(EMPTY_GRID());
  const [saving, setSaving] = useState(false);
  const [activeCell, setActiveCell] = useState<{ r: number; c: number } | null>(null);
  const [formulaBar, setFormulaBar] = useState("");
  const [showFuncPicker, setShowFuncPicker] = useState(false);

  // History for undo/redo
  const [history, setHistory] = useState<Grid[]>([]);
  const [redoStack, setRedoStack] = useState<Grid[]>([]);

  // Find & replace
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  // Sort
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Clipboard
  const [clipboard, setClipboard] = useState<{ grid: Grid; r: number; c: number } | null>(null);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("client_spreadsheets")
        .select("*")
        .eq("professional_id", user.id)
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false });
      setSheets((data as ClientSpreadsheet[]) || []);
      setLoading(false);
    })();
  }, [user, clientId]);

  // Sync formula bar with active cell
  useEffect(() => {
    if (activeCell) {
      const cell = grid[activeCell.r]?.[activeCell.c];
      setFormulaBar(cell?.v ?? "");
    }
  }, [activeCell, grid]);

  // Compute display grid (with formulas evaluated)
  const displayGrid = useMemo(() => {
    return grid.map((row, r) =>
      row.map((cell, c) => {
        if (isFormula(cell.v)) {
          return { v: evaluateCell(cell.v, grid) };
        }
        return cell;
      })
    );
  }, [grid]);

  const pushHistory = useCallback((snapshot: Grid) => {
    setHistory((prev) => [...prev.slice(-49), cloneGrid(snapshot)]);
    setRedoStack([]);
  }, []);

  function openNew(type: "diet" | "workout") {
    setEditingSheet(null);
    setIsCreating(true);
    setSheetType(type);
    setTitle(type === "diet" ? "Plano alimentar" : "Plano de treino");
    const g = type === "diet" ? DIET_TEMPLATE() : WORKOUT_TEMPLATE();
    setGrid(g);
    setHistory([]);
    setRedoStack([]);
    setActiveCell({ r: 0, c: 0 });
  }

  function openEdit(sheet: ClientSpreadsheet) {
    setEditingSheet(sheet);
    setIsCreating(true);
    setSheetType(sheet.sheet_type);
    setTitle(sheet.title);
    const g = gridFromData(sheet.data);
    setGrid(g);
    setHistory([]);
    setRedoStack([]);
    setActiveCell({ r: 0, c: 0 });
  }

  function closeEditor() {
    setIsCreating(false);
    setEditingSheet(null);
    setTitle("");
    setGrid(EMPTY_GRID());
    setActiveCell(null);
    setHistory([]);
    setRedoStack([]);
  }

  function updateCell(r: number, c: number, value: string) {
    pushHistory(grid);
    setGrid((prev) => prev.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? { v: value } : cell)) : row)));
  }

  function undo() {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((rp) => [...rp, cloneGrid(grid)]);
      setGrid(cloneGrid(last));
      return prev.slice(0, -1);
    });
  }

  function redo() {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];
      setHistory((h) => [...h, cloneGrid(grid)]);
      setGrid(cloneGrid(next));
      return prev.slice(0, -1);
    });
  }

  // Row/Col operations
  function insertRow(at: number) {
    pushHistory(grid);
    const cols = grid[0]?.length ?? 6;
    setGrid((prev) => [...prev.slice(0, at), Array.from({ length: cols }, () => ({ v: "" })), ...prev.slice(at)]);
  }

  function insertCol(at: number) {
    pushHistory(grid);
    setGrid((prev) => prev.map((row) => [...row.slice(0, at), { v: "" }, ...row.slice(at)]));
  }

  function deleteRow(at: number) {
    if (grid.length <= 1) return;
    pushHistory(grid);
    setGrid((prev) => prev.filter((_, i) => i !== at));
  }

  function deleteCol(at: number) {
    if ((grid[0]?.length ?? 0) <= 1) return;
    pushHistory(grid);
    setGrid((prev) => prev.map((row) => row.filter((_, i) => i !== at)));
  }

  function addRow() { insertRow(grid.length); }
  function addCol() { insertCol(grid[0]?.length ?? 0); }

  // Copy / Paste
  function copySelection() {
    if (!activeCell) return;
    setClipboard({ grid: cloneGrid(grid), r: activeCell.r, c: activeCell.c });
  }

  function pasteSelection() {
    if (!activeCell || !clipboard) return;
    pushHistory(grid);
    setGrid((prev) => {
      const newGrid = cloneGrid(prev);
      const dr = activeCell.r - clipboard.r;
      const dc = activeCell.c - clipboard.c;
      for (let r = 0; r < clipboard.grid.length; r++) {
        for (let c = 0; c < (clipboard.grid[r]?.length ?? 0); c++) {
          const tr = r + dr;
          const tc = c + dc;
          if (tr >= 0 && tr < newGrid.length && tc >= 0 && tc < (newGrid[0]?.length ?? 0)) {
            newGrid[tr][tc] = { v: clipboard.grid[r][c].v };
          }
        }
      }
      return newGrid;
    });
  }

  // Clear cell
  function clearCell() {
    if (!activeCell) return;
    updateCell(activeCell.r, activeCell.c, "");
  }

  // Find & replace
  function findAllMatches(): { r: number; c: number }[] {
    if (!findText) return [];
    const matches: { r: number; c: number }[] = [];
    grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell.v.toLowerCase().includes(findText.toLowerCase())) {
          matches.push({ r, c });
        }
      });
    });
    return matches;
  }

  function replaceAll() {
    if (!findText) return;
    pushHistory(grid);
    setGrid((prev) =>
      prev.map((row) =>
        row.map((cell) => ({
          v: cell.v.split(findText).join(replaceText),
        }))
      )
    );
  }

  // Sort by column
  function toggleSort(c: number) {
    pushHistory(grid);
    if (sortCol === c) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(c);
      setSortAsc(true);
    }
    setGrid((prev) => {
      const header = prev[0];
      const body = prev.slice(1);
      body.sort((a, b) => {
        const av = a[c]?.v ?? "";
        const bv = b[c]?.v ?? "";
        const an = parseFloat(av);
        const bn = parseFloat(bv);
        if (!isNaN(an) && !isNaN(bn)) return sortAsc ? an - bn : bn - an;
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
      return [header, ...body];
    });
  }

  // Formula bar update
  function updateFromFormulaBar(value: string) {
    setFormulaBar(value);
    if (activeCell) {
      setGrid((prev) => prev.map((row, ri) => (ri === activeCell.r ? row.map((cell, ci) => (ci === activeCell.c ? { v: value } : cell)) : row)));
    }
  }

  async function saveSheet() {
    if (!user || !title.trim()) return;
    setSaving(true);
    const data = gridToData(grid);
    if (editingSheet) {
      const { data: updated } = await supabase
        .from("client_spreadsheets")
        .update({ title: title.trim(), sheet_type: sheetType, data: data as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
        .eq("id", editingSheet.id)
        .select("*")
        .single();
      if (updated) {
        setSheets((prev) => prev.map((s) => (s.id === updated.id ? (updated as ClientSpreadsheet) : s)));
        closeEditor();
      }
    } else {
      const { data: created } = await supabase
        .from("client_spreadsheets")
        .insert({ professional_id: user.id, client_id: clientId, title: title.trim(), sheet_type: sheetType, data: data as unknown as Record<string, unknown> })
        .select("*")
        .single();
      if (created) {
        setSheets((prev) => [created as ClientSpreadsheet, ...prev]);
        closeEditor();
      }
    }
    setSaving(false);
  }

  async function deleteSheet(id: string) {
    const { error } = await supabase.from("client_spreadsheets").delete().eq("id", id);
    if (!error) setSheets((prev) => prev.filter((s) => s.id !== id));
  }

  function handleKeyDown(e: React.KeyboardEvent, r: number, c: number) {
    const maxR = grid.length - 1;
    const maxC = (grid[0]?.length ?? 1) - 1;

    // Ctrl/Cmd shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "z") { e.preventDefault(); undo(); return; }
      if (e.key === "y" || (e.shiftKey && e.key === "Z")) { e.preventDefault(); redo(); return; }
      if (e.key === "c") { e.preventDefault(); copySelection(); return; }
      if (e.key === "v") { e.preventDefault(); pasteSelection(); return; }
      if (e.key === "f") { e.preventDefault(); setShowFind(true); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); clearCell(); return; }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (r < maxR) {
        const key = `${r + 1}-${c}`;
        inputRefs.current[key]?.focus();
        setActiveCell({ r: r + 1, c });
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const nextC = e.shiftKey ? c - 1 : c + 1;
      if (nextC >= 0 && nextC <= maxC) {
        const key = `${r}-${nextC}`;
        inputRefs.current[key]?.focus();
        setActiveCell({ r, c: nextC });
      } else if (nextC > maxC && r < maxR) {
        const key = `${r + 1}-0`;
        inputRefs.current[key]?.focus();
        setActiveCell({ r: r + 1, c: 0 });
      }
    } else if (e.key === "ArrowDown" && r < maxR) {
      e.preventDefault();
      const key = `${r + 1}-${c}`;
      inputRefs.current[key]?.focus();
      setActiveCell({ r: r + 1, c });
    } else if (e.key === "ArrowUp" && r > 0) {
      e.preventDefault();
      const key = `${r - 1}-${c}`;
      inputRefs.current[key]?.focus();
      setActiveCell({ r: r - 1, c });
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (isCreating) {
    const maxC = (grid[0]?.length ?? 1) - 1;
    const activeRef = activeCell ? makeRef(activeCell.r, activeCell.c) : "";
    const activeDisplay = activeCell ? displayGrid[activeCell.r]?.[activeCell.c]?.v ?? "" : "";
    const canUndo = history.length > 0;
    const canRedo = redoStack.length > 0;
    const findMatches = showFind ? findAllMatches() : [];

    return (
      <div className="flex flex-col gap-3">
        {/* Editor header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da planilha"
              className="max-w-xs font-medium"
            />
            <div className="flex gap-2">
              {(["diet", "workout"] as const).map((st) => (
                <button key={st} onClick={() => setSheetType(st)}
                  className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    sheetType === st
                      ? st === "diet" ? "bg-orange-500 text-white" : "bg-cyan-500 text-white"
                      : "bg-surface-card text-content-muted border border-edge-base")}>
                  {st === "diet" ? "Dieta" : "Treino"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={closeEditor} className="gap-1.5">
              <X className="h-4 w-4" />Cancelar
            </Button>
            <Button size="sm" onClick={saveSheet} disabled={saving || !title.trim()} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* Formula bar */}
        <div className="flex items-center gap-2 rounded-lg border border-edge-base bg-surface-card px-2 py-1.5">
          <span className="flex h-7 w-14 shrink-0 items-center justify-center rounded bg-surface-subtle text-xs font-bold text-content-strong">
            {activeRef || "—"}
          </span>
          <FunctionSquare className="h-4 w-4 shrink-0 text-primary-500" />
          <input
            type="text"
            value={formulaBar}
            onChange={(e) => updateFromFormulaBar(e.target.value)}
            placeholder="Digite um valor ou fórmula (ex: =SUM(A1:A10))"
            className="flex-1 bg-transparent text-sm text-content-strong outline-none"
          />
          {activeCell && isFormula(formulaBar) && (
            <span className="hidden shrink-0 text-xs text-content-muted sm:block">
              = {activeDisplay}
            </span>
          )}
          <div className="relative shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFuncPicker(!showFuncPicker)}
              className="h-7 gap-1 px-2 text-xs"
            >
              <Sigma className="h-3.5 w-3.5" /> fx
              <ChevronDown className="h-3 w-3" />
            </Button>
            {showFuncPicker && (
              <div className="absolute right-0 top-full z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-edge-base bg-surface-card shadow-lg">
                {FORMULA_FUNCTIONS.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => {
                      if (activeCell) {
                        updateFromFormulaBar(`=${f.name}(`);
                        inputRefs.current[`${activeCell.r}-${activeCell.c}`]?.focus();
                      }
                      setShowFuncPicker(false);
                    }}
                    className="flex w-full flex-col gap-0.5 border-b border-edge-base px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-surface-subtle"
                  >
                    <span className="text-xs font-bold text-primary-600">={f.name}</span>
                    <span className="text-[10px] text-content-muted">{f.desc}</span>
                    <span className="text-[10px] font-mono text-content-body">{f.example}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Undo / Redo */}
          <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo} className="h-8 gap-1 px-2">
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo} className="h-8 gap-1 px-2">
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <div className="h-5 w-px bg-edge-base" />
          {/* Copy / Paste */}
          <Button variant="outline" size="sm" onClick={copySelection} disabled={!activeCell} className="h-8 gap-1 px-2" title="Copiar (Ctrl+C)">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={pasteSelection} disabled={!activeCell || !clipboard} className="h-8 gap-1 px-2" title="Colar (Ctrl+V)">
            <Clipboard className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={clearCell} disabled={!activeCell} className="h-8 gap-1 px-2" title="Limpar (Ctrl+Del)">
            <Eraser className="h-3.5 w-3.5" />
          </Button>
          <div className="h-5 w-px bg-edge-base" />
          {/* Insert row/col */}
          <Button variant="outline" size="sm" onClick={() => activeCell && insertRow(activeCell.r)} disabled={!activeCell} className="h-8 gap-1 px-2" title="Inserir linha acima">
            <ArrowUpToLine className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => activeCell && insertRow(activeCell.r + 1)} disabled={!activeCell} className="h-8 gap-1 px-2" title="Inserir linha abaixo">
            <ArrowDownToLine className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => activeCell && insertCol(activeCell.c)} disabled={!activeCell} className="h-8 gap-1 px-2" title="Inserir coluna à esquerda">
            <ArrowLeftToLine className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => activeCell && insertCol(activeCell.c + 1)} disabled={!activeCell} className="h-8 gap-1 px-2" title="Inserir coluna à direita">
            <ArrowRightToLine className="h-3.5 w-3.5" />
          </Button>
          <div className="h-5 w-px bg-edge-base" />
          {/* Delete row/col */}
          <Button variant="outline" size="sm" onClick={() => activeCell && deleteRow(activeCell.r)} disabled={!activeCell} className="h-8 gap-1 px-2 text-red-500" title="Excluir linha">
            <Rows3 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => activeCell && deleteCol(activeCell.c)} disabled={!activeCell} className="h-8 gap-1 px-2 text-red-500" title="Excluir coluna">
            <Columns3 className="h-3.5 w-3.5" />
          </Button>
          <div className="h-5 w-px bg-edge-base" />
          {/* Find & replace */}
          <Button variant="outline" size="sm" onClick={() => setShowFind(!showFind)} className="h-8 gap-1 px-2" title="Buscar (Ctrl+F)">
            <Search className="h-3.5 w-3.5" />
          </Button>
          {/* Sort */}
          <Button variant="outline" size="sm" onClick={() => activeCell && toggleSort(activeCell.c)} disabled={!activeCell} className="h-8 gap-1 px-2" title="Ordenar por esta coluna">
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Find & replace bar */}
        {showFind && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary-200 bg-primary-50/50 px-3 py-2">
            <Search className="h-4 w-4 text-primary-500" />
            <input
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              placeholder="Buscar..."
              className="w-32 rounded border border-edge-base bg-surface-card px-2 py-1 text-xs outline-none focus:border-primary-400 sm:w-40"
            />
            <span className="text-xs text-content-muted">→</span>
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Substituir por..."
              className="w-32 rounded border border-edge-base bg-surface-card px-2 py-1 text-xs outline-none focus:border-primary-400 sm:w-40"
            />
            <Button size="sm" onClick={replaceAll} disabled={!findText} className="h-7 gap-1 px-2 text-xs">
              Substituir todos
            </Button>
            <span className="text-xs text-content-muted">
              {findMatches.length} resultado(s)
            </span>
            <button onClick={() => setShowFind(false)} className="ml-auto text-content-muted hover:text-content-strong">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Grid */}
        <div className="overflow-auto rounded-xl border border-edge-base bg-surface-card shadow-sm" style={{ maxHeight: "60vh" }}>
          <table className="border-collapse">
            <thead>
              <tr className="sticky top-0 z-20 bg-surface-subtle">
                <th className="sticky left-0 z-30 w-10 border-b border-r border-edge-base bg-surface-subtle px-2 py-1.5 text-center text-[10px] font-medium text-content-muted">
                  #
                </th>
                {grid[0]?.map((_, c) => (
                  <th
                    key={c}
                    onClick={() => toggleSort(c)}
                    className="cursor-pointer border-b border-r border-edge-base px-2 py-1.5 text-center text-[10px] font-medium text-content-muted transition-colors last:border-r-0 hover:bg-surface-base"
                    style={{ minWidth: 120 }}
                  >
                    <span className="flex items-center justify-center gap-0.5">
                      {colLetter(c)}
                      {sortCol === c && <ArrowUpDown className="h-2.5 w-2.5" />}
                    </span>
                  </th>
                )) ?? null}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, r) => (
                <tr key={r} className="group">
                  <td className="sticky left-0 z-10 w-10 border-b border-r border-edge-base bg-surface-subtle px-2 py-1 text-center text-[10px] font-medium text-content-muted">
                    {r + 1}
                  </td>
                  {row.map((cell, c) => {
                    const isMatch = findMatches.some((m) => m.r === r && m.c === c);
                    const displayVal = displayGrid[r]?.[c]?.v ?? "";
                    const isFormulaCell = isFormula(cell.v);
                    return (
                      <td key={c} className="border-b border-r border-edge-base p-0 last:border-r-0">
                        <input
                          ref={(el) => { inputRefs.current[`${r}-${c}`] = el; }}
                          type="text"
                          value={cell.v}
                          onChange={(e) => updateCell(r, c, e.target.value)}
                          onFocus={() => setActiveCell({ r, c })}
                          onKeyDown={(e) => handleKeyDown(e, r, c)}
                          className={cn(
                            "w-full bg-transparent px-2 py-1.5 text-sm text-content-strong outline-none transition-colors",
                            r === 0 ? "font-semibold text-content-strong bg-surface-subtle/50" : "text-content-body",
                            activeCell?.r === r && activeCell?.c === c && "ring-2 ring-primary-400 bg-primary-50/30",
                            isMatch && "bg-yellow-100 dark:bg-yellow-900/30",
                            isFormulaCell && "text-primary-700 dark:text-primary-300",
                          )}
                          style={{ minWidth: 120 }}
                        />
                        {/* Show evaluated result as tooltip-like subtitle for formula cells */}
                        {isFormulaCell && displayVal !== cell.v && (
                          <div className="hidden">
                            {displayVal}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quick add row/col at end */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />Adicionar linha
          </Button>
          <Button variant="outline" size="sm" onClick={addCol} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />Adicionar coluna
          </Button>
          {grid.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => deleteRow(grid.length - 1)} className="gap-1.5 text-red-500">
              <Trash2 className="h-3.5 w-3.5" />Remover última linha
            </Button>
          )}
          {(grid[0]?.length ?? 0) > 1 && (
            <Button variant="outline" size="sm" onClick={() => deleteCol(maxC)} className="gap-1.5 text-red-500">
              <Trash2 className="h-3.5 w-3.5" />Remover última coluna
            </Button>
          )}
        </div>

        <p className="text-xs text-content-muted">
          Atalhos: Enter desce, Tab avança, setas navegam. Ctrl+C copia, Ctrl+V cola, Ctrl+Z desfaz, Ctrl+Y refaz, Ctrl+F busca.
          Fórmulas: comece com = (ex: =SUM(A1:A10), =IF(A1&gt;10,"Sim","Não"), =A1+B1*C1).
        </p>
      </div>
    );
  }

  // List view
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => openNew("diet")} className="gap-1.5 border-orange-200 text-orange-600 hover:bg-orange-50">
          <Plus className="h-4 w-4" />Planilha de Dieta
        </Button>
        <Button variant="outline" size="sm" onClick={() => openNew("workout")} className="gap-1.5 border-cyan-200 text-cyan-600 hover:bg-cyan-50">
          <Plus className="h-4 w-4" />Planilha de Treino
        </Button>
      </div>

      {sheets.length === 0 ? (
        <Card className="bg-surface-card">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-subtle text-content-muted">
              <Table2 className="h-6 w-6" />
            </span>
            <p className="text-sm font-semibold text-content-strong">Nenhuma planilha criada</p>
            <p className="text-xs text-content-muted">Crie uma planilha de dieta ou treino para {clientName}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sheets.map((s) => {
            const diet = s.sheet_type === "diet";
            const rows = Array.isArray(s.data) ? (s.data as string[][]) : [];
            // Evaluate formulas for preview
            const evalGrid = rows.map((r) => r.map((v) => ({ v })));
            const previewGrid = evalGrid.map((r) => r.map((c) => ({ v: evaluateCell(c.v, evalGrid) })));
            return (
              <Card key={s.id} className="bg-surface-card">
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      diet ? "bg-orange-50 text-orange-600" : "bg-cyan-50 text-cyan-600")}>
                      <Table2 className="h-5 w-5" />
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(s)} aria-label="Editar planilha"
                        className="text-content-muted transition-colors hover:text-primary-600">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteSheet(s.id)} aria-label="Excluir planilha"
                        className="text-content-muted transition-colors hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-content-strong">{s.title}</p>
                    <p className="mt-0.5 text-xs text-content-muted">
                      {diet ? "Dieta" : "Treino"} · {rows.length} linhas · {rows[0]?.length ?? 0} colunas
                    </p>
                  </div>
                  {previewGrid.length > 0 && previewGrid[0]?.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-edge-base">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-surface-subtle">
                            {previewGrid[0].slice(0, 4).map((h, i) => (
                              <th key={i} className="border-r border-edge-base px-2 py-1 text-left font-semibold text-content-strong last:border-r-0">
                                {h.v || "—"}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewGrid.slice(1, 4).map((row, ri) => (
                            <tr key={ri}>
                              {row.slice(0, 4).map((cell, ci) => (
                                <td key={ci} className="border-r border-edge-base px-2 py-1 text-content-body last:border-r-0">
                                  {cell.v || "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {previewGrid.length > 4 && (
                        <p className="bg-surface-subtle px-2 py-1 text-center text-[10px] text-content-muted">
                          +{previewGrid.length - 4} linhas
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-content-muted">
                    Atualizada em {new Date(s.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
