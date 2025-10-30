import React, { useState, useEffect } from "react";
import {
  Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType,
  TextRun, AlignmentType, VerticalAlign, HeightRule,
  BorderStyle, LineRuleType, TableLayoutType, TextDirection
} from "docx";
import { saveAs } from "file-saver";

/* ====== Utiles ====== */
const FONT_TNR = "Times New Roman";
const tnr = (text, opts = {}) => new TextRun({ text, font: FONT_TNR, ...opts });

const MONTHS_3_ES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const formatDMY = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const formatFirmaTimestamp = (isoDate, hhmm) => {
  if (!isoDate || !hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  const dd = String(d.getDate()).padStart(2, "0");
  const [hh, mm] = hhmm.split(":");
  const mon = MONTHS_3_ES[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${hh}${mm}${mon}${yy}`;
};

const SUBUNIDADES = ["CODENA", "INTENDENCIA", "UOC", "PARQUE AUTOMOTOR", "MEYSG", "TECNICO", "TESORERIA", "CONTABILIDAD", "SANIDAD", "CONTRATACIONES", "UAI", "PERS MIL", "PERS CIV", "GASTOS EN PERSONAL", "CAFEA", "CAMBIO DE DESTINO", "AYUDANTIA", "SECRETARIA", "JURIDICA", "GRUPO COM", "SAF", "AULA DE SITUACION"];
const LINEAS_GUIONES = "------------------------------------";
const ESTADOS = ["", "E/S", "S/N", "F/S"];
const GRADOS = ["", "A/C", 'VS "EC"', "VS", "VP", "CB", "CI", "SG", "SI", "SA", "SP", "SM", "ST", "TT", "TP", "CT", "MY", "TC"];
const NOVEDADES_SUG = ["", "SIN NOVEDAD", "NO ENCIENDE", "NO DA VIDEO", "PANTALLA AZUL (BSOD)", "REINICIOS ALEATORIOS", "LENTITUD GENERAL", "ALTO USO CPU", "ALTO USO RAM", "DISCO AL 100%", "SIN RED", "MANTENIMIENTO", "SIN ACCESO A DOMINIO", "ERROR PERFILES WINDOWS", "OFFICE NO ABRE", "IMPRESORA NO RESPONDE", "DRIVER FALTANTE", "VIRUS/MALWARE DETECTADO", "ACTUALIZACIONES PENDIENTES", "RUIDO VENTILADOR", "TEMPERATURAS ALTAS"];

const baseInput = "w-full border rounded-lg px-3 h-12 md:h-10 text-base md:text-sm bg-white";
const baseSelect = baseInput + " pr-8";
const baseTextarea = "w-full border rounded-lg px-3 py-2 text-base md:text-sm min-h-[3rem]";
const labelCls = "text-sm md:text-xs font-medium text-gray-700";
const sectionCard = "bg-white rounded-xl shadow p-4 md:p-5";
const tightCell = { margins: { top: 80, bottom: 80, left: 80, right: 80 } };

const NO_UPPER = new Set(["fecha", "entregadoFecha", "entregadoHora", "recibidoFecha", "recibidoHora", "supervisado2Fecha", "supervisado2Hora", "anotadoFecha", "anotadoHora"]);
const toUpperSafe = (k, v) => (typeof v === "string" && !NO_UPPER.has(k)) ? v.toUpperCase() : v;

/* ====== Botones utilitarios ====== */
function ClearButton({ onClick, title = "Limpiar" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="ml-2 shrink-0 h-10 w-10 md:h-8 md:w-8 grid place-items-center rounded-lg border text-gray-500 hover:text-red-600 hover:border-red-400"
    >
      ×
    </button>
  );
}
function DangerButton({ onClick, children = "🗑️", title = "Eliminar" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="shrink-0 h-10 w-10 md:h-8 md:w-8 grid place-items-center rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
    >
      {children}
    </button>
  );
}

/* ====== Selects ====== */
function SelectBox({ label, value, onChange, options, placeholder }) {
  const isGrado =
    options === GRADOS ||
    (Array.isArray(options) && options.includes("A/C"));
  const firstText = placeholder ?? (isGrado ? "GRADOS" : "Seleccionar...");

  return (
    <label className="w-full">
      {label && <div className={labelCls}>{label}</div>}
      <div className="flex items-center min-w-0">
        <select
          className={baseSelect + " uppercase flex-1 min-w-0"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((opt) => (
            <option key={opt || "vacío"} value={opt}>{opt || firstText}</option>
          ))}
        </select>
        <ClearButton onClick={() => onChange("")} />
      </div>
    </label>
  );
}

/* NOVEDADES: select + “OTRA (ESCRIBIR)” */
const OTRA = "__OTRA__";
function SelectNovedad({ value, onChange, options = NOVEDADES_SUG }) {
  const showingOther = value && !options.includes(value);
  const selectValue = showingOther ? OTRA : (value ?? "");
  return (
    <div className="w-full">
      <div className="flex items-center min-w-0">
        <select
          className={baseSelect + " uppercase flex-1 min-w-0"}
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === OTRA) { onChange(""); return; }
            onChange(v);
          }}
        >
          {options.map((opt) => (
            <option key={opt || "vacío"} value={opt}>{opt || "NOVEDADES"}</option>
          ))}
          <option value={OTRA}>OTRA (ESCRIBIR)</option>
        </select>
        <ClearButton onClick={() => onChange("")} />
      </div>
      {(selectValue === OTRA || showingOther) && (
        <input
          className={`${baseInput} uppercase mt-2`}
          placeholder="Escribir novedad…"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

/* ====== Hook: detectar desktop ====== */
function useIsDesktop(minWidth = 768) {
  const query = `(min-width:${minWidth}px)`;
  const getMatch = () =>
    typeof window !== "undefined" && window.matchMedia(query).matches;
  const [isDesktop, setIsDesktop] = useState(getMatch());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const onChange = (e) => setIsDesktop(e.matches);
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);
  return isDesktop;
}

/* ====== Subcomponentes ====== */
function IdentificacionActividad({ form, update }) {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
      <SelectBox label="Subunidad" value={form.subunidad} onChange={(v) => update("subunidad", v)} options={["", ...SUBUNIDADES]} />
      <SelectBox label="Unidad" value={form.unidad} onChange={(v) => update("unidad", v)} options={["", "CGE"]} />
      <SelectBox label="NNE" value={form.nne} onChange={(v) => update("nne", v)} options={["", LINEAS_GUIONES]} />
      <SelectBox label="INE" value={form.ine} onChange={(v) => update("ine", v)} options={["", LINEAS_GUIONES]} />
      <label>
        <div className={labelCls}>Fecha</div>
        <input type="date" className={baseInput} value={form.fecha} onChange={(e) => update("fecha", e.target.value)} />
      </label>
      <label>
        <div className={labelCls}>Nro Control</div>
        <div className="flex items-center min-w-0">
          <input className={`${baseInput} uppercase flex-1 min-w-0`} placeholder="Ej: 01/25" value={form.nroControl} onChange={(e) => update("nroControl", e.target.value)} />
          <ClearButton onClick={() => update("nroControl", "")} />
        </div>
      </label>
      <label>
        <div className={labelCls}>NI</div>
        <input className={`${baseInput} uppercase`} value={form.ni} onChange={(e) => update("ni", e.target.value)} />
      </label>
      <label>
        <div className={labelCls}>Nro Serie</div>
        <input className={`${baseInput} uppercase`} value={form.nroSerie} onChange={(e) => update("nroSerie", e.target.value)} />
      </label>
      <label>
        <div className={labelCls}>Nro Motor</div>
        <input className={`${baseInput} uppercase`} value={form.nroMotor} onChange={(e) => update("nroMotor", e.target.value)} />
      </label>
      <label>
        <div className={labelCls}>KM-MS</div>
        <input className={`${baseInput} uppercase`} value={form.kmMs} onChange={(e) => update("kmMs", e.target.value)} />
      </label>
      <label>
        <div className={labelCls}>DISP.-ACC.</div>
        <input className={`${baseInput} uppercase`} value={form.dispAcc} onChange={(e) => update("dispAcc", e.target.value)} />
      </label>
      <SelectBox label="Actividad" value={form.actividad} onChange={(v) => update("actividad", v)} options={["", "MANTENIMIENTO PREVENTIVO", "MANTENIMIENTO CORRECTIVO", "INSPECCIÓN"]} />
    </div>
  );
}

function ConstanciaAnverso({ form, update }) {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
      <div className="space-y-2">
        <div className={labelCls}>26. Ejecutado por</div>
        <SelectBox label="" value={form.ejecutadoGrado} onChange={(v) => update("ejecutadoGrado", v)} options={GRADOS} />
        <div className="flex items-center min-w-0">
          <input placeholder="Apellido y Nombre" className={`${baseInput} uppercase flex-1 min-w-0`} value={form.ejecutadoNombre} onChange={(e) => update("ejecutadoNombre", e.target.value)} />
          <ClearButton onClick={() => update("ejecutadoNombre", "")} />
        </div>
      </div>
      <div className="space-y-2">
        <div className={labelCls}>27. Supervisado por</div>
        <SelectBox label="" value={form.supervisadoGrado} onChange={(v) => update("supervisadoGrado", v)} options={GRADOS} />
        <div className="flex items-center min-w-0">
          <input placeholder="Apellido y Nombre" className={`${baseInput} uppercase flex-1 min-w-0`} value={form.supervisadoNombre} onChange={(e) => update("supervisadoNombre", e.target.value)} />
          <ClearButton onClick={() => update("supervisadoNombre", "")} />
        </div>
      </div>
    </div>
  );
}

function TareasCH({ rows, setRow, addRow, removeRow, MAX_VISIBLE_ROWS }) {
  return (
    <>
      <div className="mt-3 hidden sm:grid grid-cols-[1fr,1fr,2fr,2fr,1fr,auto] gap-2 items-center mb-1 text-xs font-semibold text-gray-600 px-1 md:px-2">
        <span className="text-center">D. REFERENCIA</span>
        <span className="text-center">E. ESTADO</span>
        <span>F. NOVEDADES</span>
        <span>G. ACCIÓN CORRECTIVA</span>
        <span>H. INICIAL</span>
        <span></span>
      </div>
      <div className="space-y-2">
        {rows.slice(0, Math.min(rows.length, MAX_VISIBLE_ROWS)).map((r, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,2fr,2fr,1fr,auto] gap-2 items-center border sm:border-none p-2 rounded-md sm:p-0 bg-gray-50 sm:bg-transparent">
            <div className="flex items-center min-w-0">
              <input placeholder="Ej: 01" className={`${baseInput} uppercase text-center flex-1 min-w-0`} value={r.referencia} onChange={(e) => setRow(i, "referencia", e.target.value)} />
              <ClearButton onClick={() => setRow(i, "referencia", "")} />
            </div>
            <div className="flex items-center min-w-0">
              <select className={`${baseSelect} text-center flex-1 min-w-0`} value={r.estado} onChange={(e) => setRow(i, "estado", e.target.value)}>
                {ESTADOS.map(e => <option key={e || "vacío"} value={e}>{e || "Estado..."}</option>)}
              </select>
              <ClearButton onClick={() => setRow(i, "estado", "")} />
            </div>
            <SelectNovedad value={r.novedades} onChange={(v) => setRow(i, "novedades", v)} />
            <div className="flex items-center min-w-0">
              <textarea placeholder="Acción Correctiva" className={`${baseTextarea} uppercase flex-1 min-w-0`} rows={1} value={r.accionCorrectiva} onChange={(e) => setRow(i, "accionCorrectiva", e.target.value)} />
            </div>
            <div className="flex items-center min-w-0">
              <input placeholder="Inicial" className={`${baseInput} uppercase flex-1 min-w-0`} value={r.inicial} onChange={(e) => setRow(i, "inicial", e.target.value)} />
              <ClearButton onClick={() => setRow(i, "inicial", "")} />
            </div>
            <DangerButton onClick={() => removeRow(i)} title="Eliminar fila">🗑️</DangerButton>
          </div>
        ))}
      </div>
      {rows.length > MAX_VISIBLE_ROWS && (
        <p className="text-xs text-gray-500 text-center mt-2">
          ({rows.length - MAX_VISIBLE_ROWS} filas ocultas — se incluirán en el documento)
        </p>
      )}
    </>
  );
}

function ObservacionesFirmas({ form, update }) {
  return (
    <>
      <div className="mt-4">
        <label className="block">
          <div className={labelCls}>J. Observaciones</div>
          <div className="flex min-w-0">
            <textarea className={`${baseTextarea} uppercase flex-1 min-w-0`} rows={3} placeholder="Escriba aquí (opcional)" value={form.observaciones} onChange={(e) => update("observaciones", e.target.value)} />
            <ClearButton onClick={() => update("observaciones", "")} />
          </div>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ENTREGADO */}
        <div className="border rounded-lg p-3 md:p-4 space-y-2">
          <div className="font-semibold">28. Entregado por</div>
          <SelectBox value={form.entregadoGrado} onChange={(v) => update("entregadoGrado", v)} options={GRADOS} />
          <div className="flex items-center min-w-0">
            <input className={`${baseInput} uppercase flex-1 min-w-0`} placeholder="Apellido y Nombre" value={form.entregadoPor} onChange={(e) => update("entregadoPor", e.target.value)} />
            <ClearButton onClick={() => update("entregadoPor", "")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label><div className="text-xs font-medium text-gray-600">Fecha (reverso)</div>
              <input type="date" className={baseInput} value={form.entregadoFecha} onChange={(e) => update("entregadoFecha", e.target.value)} />
            </label>
            <label><div className="text-xs font-medium text-gray-600">Hora (reverso)</div>
              <input type="time" className={baseInput} value={form.entregadoHora} onChange={(e) => update("entregadoHora", e.target.value)} />
            </label>
          </div>
        </div>

        {/* RECIBIDO */}
        <div className="border rounded-lg p-3 md:p-4 space-y-2">
          <div className="font-semibold">24. Recibido por</div>
          <SelectBox value={form.recibidoGrado} onChange={(v) => update("recibidoGrado", v)} options={GRADOS} />
          <div className="flex items-center min-w-0">
            <input className={`${baseInput} uppercase flex-1 min-w-0`} placeholder="Apellido y Nombre" value={form.recibidoPor} onChange={(e) => update("recibidoPor", e.target.value)} />
            <ClearButton onClick={() => update("recibidoPor", "")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label><div className="text-xs font-medium text-gray-600">Fecha (reverso)</div>
              <input type="date" className={baseInput} value={form.recibidoFecha} onChange={(e) => update("recibidoFecha", e.target.value)} />
            </label>
            <label><div className="text-xs font-medium text-gray-600">Hora (reverso)</div>
              <input type="time" className={baseInput} value={form.recibidoHora} onChange={(e) => update("recibidoHora", e.target.value)} />
            </label>
          </div>
        </div>

        {/* SUPERVISADO */}
        <div className="border rounded-lg p-3 md:p-4 space-y-2">
          <div className="font-semibold">25. Supervisado por</div>
          <SelectBox value={form.supervisado2Grado} onChange={(v) => update("supervisado2Grado", v)} options={GRADOS} />
          <div className="flex items-center min-w-0">
            <input className={`${baseInput} uppercase flex-1 min-w-0`} placeholder="Apellido y Nombre" value={form.supervisadoPor2} onChange={(e) => update("supervisadoPor2", e.target.value)} />
            <ClearButton onClick={() => update("supervisadoPor2", "")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label><div className="text-xs font-medium text-gray-600">Fecha (reverso)</div>
              <input type="date" className={baseInput} value={form.supervisado2Fecha} onChange={(e) => update("supervisado2Fecha", e.target.value)} />
            </label>
            <label><div className="text-xs font-medium text-gray-600">Hora (reverso)</div>
              <input type="time" className={baseInput} value={form.supervisado2Hora} onChange={(e) => update("supervisado2Hora", e.target.value)} />
            </label>
          </div>
        </div>

        {/* ANOTADO */}
        <div className="border rounded-lg p-3 md:p-4 space-y-2">
          <div className="font-semibold">30. Anotado/Controlado por</div>
          <SelectBox value={form.anotadoGrado} onChange={(v) => update("anotadoGrado", v)} options={GRADOS} />
          <div className="flex items-center min-w-0">
            <input className={`${baseInput} uppercase flex-1 min-w-0`} placeholder="Apellido y Nombre" value={form.anotadoControladoPor} onChange={(e) => update("anotadoControladoPor", e.target.value)} />
            <ClearButton onClick={() => update("anotadoControladoPor", "")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label><div className="text-xs font-medium text-gray-600">Fecha (reverso)</div>
              <input type="date" className={baseInput} value={form.anotadoFecha} onChange={(e) => update("anotadoFecha", e.target.value)} />
            </label>
            <label><div className="text-xs font-medium text-gray-600">Hora (reverso)</div>
              <input type="time" className={baseInput} value={form.anotadoHora} onChange={(e) => update("anotadoHora", e.target.value)} />
            </label>
          </div>
        </div>
      </div>
    </>
  );
}

/* ====== Componente principal ====== */
export default function SRE2404App() {
  const hoyISO = new Date().toISOString().slice(0, 10);
  const isDesktop = useIsDesktop();

  const [form, setForm] = useState({
    fecha: hoyISO,
    nroControl: "",
    subunidad: "",
    unidad: "CGE",
    nne: LINEAS_GUIONES,
    ine: LINEAS_GUIONES,
    ni: "",
    nroSerie: "",
    nroMotor: "",
    kmMs: "",
    dispAcc: "",
    actividad: "",
    pubRefRt: "",
    pubRefRt2: "",
    pubRefGl: "",
    otras: "",
    ejecutadoGrado: "",
    ejecutadoNombre: "",
    supervisadoGrado: "",
    supervisadoNombre: "",
    observaciones: "",
    entregadoGrado: "", entregadoPor: "", entregadoFecha: "", entregadoHora: "",
    recibidoGrado: "", recibidoPor: "", recibidoFecha: "", recibidoHora: "",
    supervisado2Grado: "", supervisadoPor2: "", supervisado2Fecha: "", supervisado2Hora: "",
    anotadoGrado: "", anotadoControladoPor: "", anotadoFecha: "", anotadoHora: "",
  });

  const EMPTY_ROW = { referencia: "", estado: "", novedades: "", accionCorrectiva: "", inicial: "" };
  const [rows, setRows] = useState([{ ...EMPTY_ROW }]);
  const TOTAL_DOC_ROWS = 18;
  const MAX_VISIBLE_ROWS = isDesktop ? TOTAL_DOC_ROWS : 5;

  const addRow = () => setRows(r => [...r, { ...EMPTY_ROW }]);
  const removeRow = (i) => setRows(r => r.filter((_, idx) => idx !== i));
  const update = (k, v) => setForm(f => ({ ...f, [k]: toUpperSafe(k, v) }));
  const setRow = (i, k, v) =>
    setRows(r => r.map((row, idx) => (idx === i ? { ...row, [k]: (typeof v === "string" ? v.toUpperCase() : v) } : row)));

  // DOCX helpers
  const createLineParagraph = (label, value, isCentered = false) => ([
    new Paragraph({ children: [tnr(label, { size: 20 })], spacing: { after: 0, before: 0 } }),
    new Paragraph({
      children: [tnr(value || " ", { size: 20 })],
      spacing: { after: 0, before: 0 },
      alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
    }),
  ]);


  
  const generateDoc = () => {
  // ==== Definiciones de anchos fijos A4 ====
  const PAGE_WIDTH_DXA = 11906;     // A4
  const MARGIN_DXA = 720;
  const CONTENT_DXA = PAGE_WIDTH_DXA - 2 * MARGIN_DXA; // 10466 DXA

  const borderSizeThick = 24;
  const bordersThick = {
    top: { style: BorderStyle.SINGLE, size: borderSizeThick },
    bottom: { style: BorderStyle.SINGLE, size: borderSizeThick },
    left: { style: BorderStyle.SINGLE, size: borderSizeThick },
    right: { style: BorderStyle.SINGLE, size: borderSizeThick },
    insideH: { style: BorderStyle.SINGLE, size: borderSizeThick },
    insideV: { style: BorderStyle.SINGLE, size: borderSizeThick },
  };

    const noBorders = {
      top: { style: BorderStyle.NONE, size: 0 },
      bottom: { style: BorderStyle.NONE, size: 0 },
      left: { style: BorderStyle.NONE, size: 0 },
      right: { style: BorderStyle.NONE, size: 0 },
    };

    const signatureRowHeight = { value: 700, rule: HeightRule.AT_LEAST };
    const thirdRowHeight = { value: 400, rule: HeightRule.AT_LEAST };
    const pubRowHeight = { value: 600, rule: HeightRule.AT_LEAST };
    const taskTableRowHeight = { value: 400, rule: HeightRule.AT_LEAST };
    const headerTaskHeight = { value: 600, rule: HeightRule.AT_LEAST };

    const emptyObservacionRow = new TableRow({
      height: { value: 300, rule: HeightRule.AT_LEAST },
      children: [new TableCell({ children: [new Paragraph({ children: [tnr(" ")] })] })]
    });

    // ---- Cabecera tareas (anverso) ----
    const taskHeaderRow = new TableRow({
      tableHeader: true, height: headerTaskHeight,
      children: [
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr("D. REFE", { size: 20, bold: true }), tnr("RENCIA", { size: 20, bold: true, break: 1 })] })],
          verticalAlign: VerticalAlign.TOP,
          borders: { right: { style: BorderStyle.SINGLE, size: borderSizeThick }, bottom: { style: BorderStyle.SINGLE, size: borderSizeThick } },
        }),
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr("E. ES", { size: 20, bold: true }), tnr("TADO", { size: 20, bold: true, break: 1 })] })],
          verticalAlign: VerticalAlign.TOP,
          borders: { right: { style: BorderStyle.SINGLE, size: borderSizeThick }, bottom: { style: BorderStyle.SINGLE, size: borderSizeThick } },
        }),
        // 🔧 Corregido: SIN JSX. Solo instancias de docx:
        new TableCell({
          children: [
            new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 0, before: 0 }, children: [tnr("F.", { size: 20, bold: true })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [tnr("NOVEDADES", { size: 20, bold: true })] }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          borders: { right: { style: BorderStyle.SINGLE, size: borderSizeThick }, bottom: { style: BorderStyle.SINGLE, size: borderSizeThick } },
        }),
        new TableCell({
          children: [
            new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 0, before: 0 }, children: [tnr("G.", { size: 20, bold: true })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [tnr("ACCIÓN  CORRECTIVA", { size: 20, bold: true })] }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          borders: { right: { style: BorderStyle.SINGLE, size: borderSizeThick }, bottom: { style: BorderStyle.SINGLE, size: borderSizeThick } },
        }),
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [tnr("H. INICIAL", { size: 20, bold: true })] })],
          verticalAlign: VerticalAlign.TOP,
          borders: { bottom: { style: BorderStyle.SINGLE, size: borderSizeThick } },
        }),
      ],
    });

    // Relleno a 20 filas
    const rowsForDoc = [
      ...rows,
      ...Array.from({ length: Math.max(TOTAL_DOC_ROWS - rows.length, 0) }, () => ({ ...EMPTY_ROW }))
    ].slice(0, TOTAL_DOC_ROWS);

    const taskDataRows = rowsForDoc.map((row) =>
      new TableRow({
        height: taskTableRowHeight,
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr(row.referencia, { size: 20 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr(row.estado, { size: 20 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [tnr(row.novedades, { size: 20 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [tnr(row.accionCorrectiva, { size: 20 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [tnr(row.inicial, { size: 20 })] })] }),
        ],
      })
    );

// columnas fijas según las medidas solicitadas
const COL_D_REFE = 992;   // 1,75 cm
const COL_E_EST = 709;    // 1,25 cm
const COL_F_NOV = 3756;   // restante repartido
const COL_G_ACC = 3756;
const COL_H_INI = 1253;   // 2,21 cm

const unifiedTaskTable = new Table({
  width: { size: CONTENT_DXA, type: WidthType.DXA },
  layout: TableLayoutType.FIXED,
  columnWidths: [COL_D_REFE, COL_E_EST, COL_F_NOV, COL_G_ACC, COL_H_INI],
  borders: bordersThick,
  rows: [taskHeaderRow, ...taskDataRows],
});



 // ==== Constantes de página (A4) y anchos exactos ====

const PAG12_BOX_DXA = 2194;        // ancho de "12. PAG" (≈ 3,87 cm)
const LEFT_FOOTER_DXA = CONTENT_DXA - PAG12_BOX_DXA; // 8272

// ... (tu código)

// ==== Pie ANVERSO con anchos exactos (arregla "12. PAG" en PC) ====
const footerAnverso = new Table({
  width: { size: CONTENT_DXA, type: WidthType.DXA },
  layout: TableLayoutType.FIXED,
  columnWidths: [LEFT_FOOTER_DXA, PAG12_BOX_DXA],
  borders: noBorders,
  rows: [
    new TableRow({
      height: { value: 300, rule: HeightRule.AT_LEAST },
      children: [
        // Izquierda: leyendas y línea superior fina
        new TableCell({
          width: { size: LEFT_FOOTER_DXA, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 12 },
            left: { style: BorderStyle.NONE, size: 0 },
            right: { style: BorderStyle.NONE, size: 0 },
            bottom: { style: BorderStyle.NONE, size: 0 },
          },
          verticalAlign: VerticalAlign.BOTTOM,
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { before: 0, after: 0 },
              children: [tnr("SRE 2404", { size: 16, bold: true })],
            }),
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { before: 0, after: 0 },
              children: [tnr("(RFD-21-01-III)", { size: 16 })],
            }),
          ],
        }),

        // Derecha: caja 12. PAG perfectamente encajada
        new TableCell({
          width: { size: PAG12_BOX_DXA, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.SINGLE, size: borderSizeThick },
            right: { style: BorderStyle.SINGLE, size: borderSizeThick },
            bottom: { style: BorderStyle.SINGLE, size: borderSizeThick },
            left: { style: BorderStyle.SINGLE, size: borderSizeThick },
          },
          verticalAlign: VerticalAlign.TOP,
          // márgenes internos sobrios para no forzar reflujo
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { before: 0, after: 0 },
              children: [tnr("12. PAG", { size: 24, bold: true })],
            }),
          ],
        }),
      ],
    }),
  ],
});


    const selloEnt = formatFirmaTimestamp(form.entregadoFecha, form.entregadoHora);
    const selloRec = formatFirmaTimestamp(form.recibidoFecha, form.recibidoHora);
    const selloSup = formatFirmaTimestamp(form.supervisado2Fecha, form.supervisado2Hora);
    const selloAno = formatFirmaTimestamp(form.anotadoFecha, form.anotadoHora);

    /* ====== REVERSO: bloque C–H ====== */
    const reversoTaskHeaderRow = new TableRow({
      tableHeader: true,
      height: headerTaskHeight,
      children: [
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr("D.REFE", { size: 20, bold: true }), tnr("RENCIA", { size: 20, bold: true, break: 1 })] })],
          verticalAlign: VerticalAlign.TOP,
          borders: { right: { style: BorderStyle.SINGLE, size: borderSizeThick }, bottom: { style: BorderStyle.SINGLE, size: borderSizeThick } },
        }),
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr("E.ES", { size: 20, bold: true }), tnr("TADO", { size: 20, bold: true, break: 1 })] })],
          verticalAlign: VerticalAlign.TOP,
          borders: { right: { style: BorderStyle.SINGLE, size: borderSizeThick }, bottom: { style: BorderStyle.SINGLE, size: borderSizeThick } },
        }),
        new TableCell({
          children: [
            new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 0, before: 0 }, children: [tnr("F.", { size: 20, bold: true })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [tnr("NOVEDADES", { size: 20, bold: true })] }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          borders: { right: { style: BorderStyle.SINGLE, size: borderSizeThick }, bottom: { style: BorderStyle.SINGLE, size: borderSizeThick } },
        }),
        new TableCell({
          children: [
            new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 0, before: 0 }, children: [tnr("G.", { size: 20, bold: true })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 }, children: [tnr("ACCION  CORRECTIVA", { size: 20, bold: true })] }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          borders: { right: { style: BorderStyle.SINGLE, size: borderSizeThick }, bottom: { style: BorderStyle.SINGLE, size: borderSizeThick } },
        }),
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr("H. INI-", { size: 20, bold: true }), tnr("CIAL", { size: 20, bold: true, break: 1 })] })],
          verticalAlign: VerticalAlign.TOP,
          borders: { bottom: { style: BorderStyle.SINGLE, size: borderSizeThick } },
        }),
      ],
    });

    const reversoTaskRows = Array.from({ length: 15 }, () =>
      new TableRow({
        height: taskTableRowHeight,
        children: Array.from({ length: 5 }, () => new TableCell({ children: [new Paragraph({ children: [tnr(" ", { size: 20 })] })] })),
      })
    );

    const reversoTaskTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [6, 6, 41, 41, 6],
      borders: bordersThick,
      rows: [reversoTaskHeaderRow, ...reversoTaskRows],
    });

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children: [
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [tnr("SRE 2404", { size: 20, bold: true })], spacing: { after: 300 } }),

          // Encabezado principal
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [10, 20, 20, 15, 15, 20],
            borders: bordersThick,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 4, verticalAlign: VerticalAlign.CENTER,
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "HOJA DE TRABAJO", size: 28, bold: true, font: "Arial" }), tnr("   PARA MANTENIMIENTO", { size: 20 })] })],
                  }),
                  new TableCell({ columnSpan: 1, children: [...createLineParagraph("3. FECHA", formatDMY(form.fecha))], verticalAlign: VerticalAlign.TOP }),
                  new TableCell({ columnSpan: 1, children: [...createLineParagraph("4. Nro CONTROL.", form.nroControl)], verticalAlign: VerticalAlign.TOP }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ columnSpan: 1, children: [...createLineParagraph("1. SUBUNIDAD", form.subunidad, true)], verticalAlign: VerticalAlign.TOP }),
                  new TableCell({ columnSpan: 1, children: [...createLineParagraph("2.1. UNIDAD", form.unidad, true)], verticalAlign: VerticalAlign.TOP }),
                  new TableCell({ columnSpan: 2, children: [...createLineParagraph("7. NNE", form.nne, true)], verticalAlign: VerticalAlign.TOP }),
                  new TableCell({ columnSpan: 2, children: [...createLineParagraph("8. INE", form.ine, true)], verticalAlign: VerticalAlign.TOP }),
                ]
              }),
              new TableRow({
                height: thirdRowHeight,
                children: [
                  new TableCell({ children: [...createLineParagraph("9. NI", form.ni)], verticalAlign: VerticalAlign.TOP }),
                  new TableCell({ children: [...createLineParagraph("10. NRO SERIE", form.nroSerie)], verticalAlign: VerticalAlign.TOP }),
                  new TableCell({ children: [...createLineParagraph("10 NRO MOTOR", form.nroMotor)], verticalAlign: VerticalAlign.TOP }),
                  new TableCell({ children: [...createLineParagraph("14. KM-MS", form.kmMs)], verticalAlign: VerticalAlign.TOP }),
                  new TableCell({ children: [...createLineParagraph("14.DISP.-ACC.", form.dispAcc)], verticalAlign: VerticalAlign.TOP }),
                  new TableCell({ children: [...createLineParagraph("A. ACTIVIDAD", form.actividad)], verticalAlign: VerticalAlign.TOP }),
                ]
              })
            ]
          }),

          new Paragraph({ spacing: { after: 100 } }),

          // Publicaciones / Constancia
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [25, 25, 25, 25],
            borders: bordersThick,
            rows: [
              new TableRow({ children: [new TableCell({ columnSpan: 4, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PUBLICACIONES DE REFERENCIA', size: 28, bold: true, font: "Arial" })] })] })] }),
              new TableRow({
                height: pubRowHeight,
                children: [
                  new TableCell({ children: [...createLineParagraph("11.RT", form.pubRefRt)], verticalAlign: VerticalAlign.TOP }),
                  new TableCell({ children: [...createLineParagraph("11.RT", form.pubRefRt2)], verticalAlign: VerticalAlign.TOP }),
                  new TableCell({ children: [...createLineParagraph("11b.GL", form.pubRefGl)], verticalAlign: VerticalAlign.TOP }),
                  new TableCell({ children: [...createLineParagraph("B. OTRAS", form.otras)], verticalAlign: VerticalAlign.TOP })
                ]
              }),
              new TableRow({ children: [new TableCell({ columnSpan: 4, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CONSTANCIA', size: 28, bold: true, font: "Arial" })] })] })] }),
              new TableRow({
                children: [new TableCell({
                  columnSpan: 4, children: [new Paragraph({
                    text: "Todas las actividades de Mantenimiento Preventivo y Correctivo y de Inspección del efecto, registradas en este formulario, han sido cumplidas de acuerdo con los procedimientos y normas de mantenimiento e inspección especificados en las publicaciones técnicas correspondientes.",
                    spacing: { line: 300, rule: LineRuleType.AUTO }, children: [tnr("", { size: 24 })]
                  })]
                })]
              }),
              new TableRow({
                height: signatureRowHeight,
                children: [
                  new TableCell({
                    columnSpan: 2, verticalAlign: VerticalAlign.TOP,
                    children: [
                      new Paragraph({ children: [tnr("26. EJECUTADO POR", { size: 20 })] }),
                      new Paragraph({ children: [tnr(`${form.ejecutadoGrado ? form.ejecutadoGrado + " " : ""}${form.ejecutadoNombre}`)], spacing: { before: 200 } })
                    ]
                  }),
                  new TableCell({
                    columnSpan: 1, verticalAlign: VerticalAlign.TOP,
                    children: [
                      new Paragraph({ children: [tnr("27.SUPERVISADO POR", { size: 20 })] }),
                      new Paragraph({ children: [tnr(`${form.supervisadoGrado ? form.supervisadoGrado + " " : ""}${form.supervisadoNombre}`)], spacing: { before: 200 } })
                    ]
                  }),
                  new TableCell({ columnSpan: 1, verticalAlign: VerticalAlign.TOP, children: [new Paragraph({ children: [tnr("C. HS-HOMBRE", { size: 20 })] })] }),
                ]
              })
            ]
          }),

          new Paragraph({ spacing: { after: 200 } }),

          // Tareas (anverso)
          unifiedTaskTable,

          // Pie ANVERSO
          footerAnverso,

          // --- REVERSO ---
         new Paragraph({
  children: [tnr("SRE 2404", { size: 20, bold: true })],
  spacing: { before: 4000, after: 300 }, // 👈 margen top extra
}),


          // Bloque C–H en reverso (arriba de Observaciones)
          reversoTaskTable,
          new Paragraph({ spacing: { after: 200 } }),

          // Observaciones (reverso)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: bordersThick,
            rows: [
              new TableRow({
                height: { value: 800, rule: HeightRule.AT_LEAST },
                children: [
                  new TableCell({
                    verticalAlign: VerticalAlign.BOTTOM,
                    margins: { top: 40, bottom: 20, left: 80, right: 80 },
                    children: [
                      new Paragraph({ children: [tnr("J. OBSERVACIONES:", { size: 20, bold: true })], spacing: { before: 0, after: 200 }, alignment: AlignmentType.LEFT }),
                      new Paragraph({ children: [tnr("NOTA: ", { size: 20 }), tnr(form.observaciones, { size: 20 })], spacing: { before: 0, after: 0 }, alignment: AlignmentType.LEFT }),
                    ],
                  }),
                ],
              }),
              ...Array(5).fill(emptyObservacionRow),
            ],
          }),

          new Paragraph({ spacing: { after: 200 } }),

          // Firmas + sellos
          new Table({
            width: { size: 10400, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [685, 2541, 2541, 2541, 2542],
            borders: bordersThick,
            rows: [
              new TableRow({
                height: { value: 300, rule: HeightRule.AT_LEAST },
                children: [
                  new TableCell({ ...tightCell, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [tnr(" ")] })] }),
                  new TableCell({ ...tightCell, verticalAlign: VerticalAlign.TOP, children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [tnr("28.", { size: 18 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr("Entregado por:", { size: 18 })] })] }),
                  new TableCell({ ...tightCell, verticalAlign: VerticalAlign.TOP, children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [tnr("24.", { size: 18 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr("Recibido Por:", { size: 18 })] })] }),
                  new TableCell({ ...tightCell, verticalAlign: VerticalAlign.TOP, children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [tnr("25.", { size: 18 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr("Supervisado por:", { size: 18 })] })] }),
                  new TableCell({ ...tightCell, verticalAlign: VerticalAlign.TOP, children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [tnr("30.", { size: 18 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr("Anotado", { size: 18 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr("Controlado por", { size: 18 })] })] }),
                ],
              }),
              new TableRow({
                height: { value: 900, rule: HeightRule.AT_LEAST },
                children: [
                  new TableCell({
                    ...tightCell,
                    textDirection: TextDirection.BOTTOM_TO_TOP_LEFT_TO_RIGHT, // 🔧 corregido: usar enum
                    verticalAlign: VerticalAlign.CENTER,
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr("Firma", { size: 18 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr("Aclarada", { size: 18 })] })]
                  }),
                  new TableCell({ ...tightCell, verticalAlign: VerticalAlign.BOTTOM, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr(`${form.entregadoGrado ? form.entregadoGrado + " " : ""}${form.entregadoPor}`, { size: 18 })] })] }),
                  new TableCell({ ...tightCell, verticalAlign: VerticalAlign.BOTTOM, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr(`${form.recibidoGrado ? form.recibidoGrado + " " : ""}${form.recibidoPor}`, { size: 18 })] })] }),
                  new TableCell({ ...tightCell, verticalAlign: VerticalAlign.BOTTOM, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr(`${form.supervisado2Grado ? form.supervisado2Grado + " " : ""}${form.supervisadoPor2}`, { size: 18 })] })] }),
                  new TableCell({ ...tightCell, verticalAlign: VerticalAlign.BOTTOM, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr(`${form.anotadoGrado ? form.anotadoGrado + " " : ""}${form.anotadoControladoPor}`, { size: 18 })] })] }),
                ],
              }),
              new TableRow({
                height: { value: 260, rule: HeightRule.AT_LEAST },
                children: [
                  new TableCell({ ...tightCell, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [tnr("Fecha", { size: 18 })] })] }),
                  new TableCell({ ...tightCell, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr(selloEnt, { size: 18 })] })] }),
                  new TableCell({ ...tightCell, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr(selloRec, { size: 18 })] })] }),
                  new TableCell({ ...tightCell, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr(selloSup, { size: 18 })] })] }),
                  new TableCell({ ...tightCell, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tnr(selloAno, { size: 18 })] })] }),
                ],
              }),
            ],
          }),

          // Pie independiente (reverso)
          new Table({
            width: { size: 10900, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [2194, 8650],
            borders: noBorders,
            rows: [
              new TableRow({
                height: { value: 300, rule: HeightRule.AT_LEAST },
                borders: { top: { style: BorderStyle.SINGLE, size: 48 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
                children: [
                  new TableCell({
                    ...tightCell,
                    borders: { top: { style: BorderStyle.SINGLE, size: borderSizeThick }, bottom: { style: BorderStyle.SINGLE, size: borderSizeThick }, left: { style: BorderStyle.SINGLE, size: borderSizeThick }, right: { style: BorderStyle.SINGLE, size: borderSizeThick } },
                    verticalAlign: VerticalAlign.TOP,
                    children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [tnr("12.PAG", { size: 26, bold: true })] })],
                  }),
                  new TableCell({
                    borders: { top: { style: BorderStyle.SINGLE, size: 18 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 } },
                    verticalAlign: VerticalAlign.BOTTOM,
                    children: [
                      new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0 }, children: [tnr("SRE 2404", { size: 16, bold: true })] }),
                      new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0 }, children: [tnr("(REVERSO)", { size: 16 })] }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `SRE_2404_${form.nroControl || "sin-numero"}.docx`);
    });
  };

  /* ====== UI ====== */
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-30 bg-gray-100/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
          <h1 className="text-lg md:text-2xl font-bold text-gray-800">SRE 2404 – Generador</h1>
          <button onClick={generateDoc} className="hidden md:inline-flex px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow">
            Generar DOC
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 md:py-6 space-y-4 md:space-y-6 pb-28 md:pb-10">
        <details open className={sectionCard + " md:hidden"}>
          <summary className="cursor-pointer select-none text-base md:text-lg font-semibold text-gray-800">
            Identificación y Actividad
          </summary>
          <IdentificacionActividad form={form} update={update} />
        </details>
        <section className={sectionCard + " hidden md:block"}>
          <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3">Identificación y Actividad</h2>
          <IdentificacionActividad form={form} update={update} />
        </section>

        <details open className={sectionCard + " md:hidden"}>
          <summary className="cursor-pointer select-none text-base md:text-lg font-semibold text-gray-800">
            Constancia (Anverso)
          </summary>
          <ConstanciaAnverso form={form} update={update} />
        </details>
        <section className={sectionCard + " hidden md:block"}>
          <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3">Constancia (Anverso)</h2>
          <ConstanciaAnverso form={form} update={update} />
        </section>

        <details open className={sectionCard + " md:hidden"}>
          <summary className="cursor-pointer select-none text-base md:text-lg font-semibold text-gray-800 flex items-center justify-between">
            C–H – Detalle de tareas
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); addRow(); }} className="ml-2 bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700 active:scale-95 transition">
              + Agregar fila
            </button>
          </summary>
          <TareasCH rows={rows} setRow={setRow} addRow={addRow} removeRow={removeRow} MAX_VISIBLE_ROWS={MAX_VISIBLE_ROWS} />
        </details>
        <section className={sectionCard + " hidden md:block"}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-semibold text-gray-800">C–H – Detalle de tareas</h2>
            <button onClick={addRow} className="ml-2 bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700 active:scale-95 transition">
              + Agregar fila
            </button>
          </div>
          <TareasCH rows={rows} setRow={setRow} addRow={addRow} removeRow={removeRow} MAX_VISIBLE_ROWS={MAX_VISIBLE_ROWS} />
        </section>

        <details open className={sectionCard + " md:hidden"}>
          <summary className="cursor-pointer select-none text-base md:text-lg font-semibold text-gray-800">
            Observaciones y Firmas (Reverso)
          </summary>
          <ObservacionesFirmas form={form} update={update} />
        </details>
        <section className={sectionCard + " hidden md:block"}>
          <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3">Observaciones y Firmas (Reverso)</h2>
          <ObservacionesFirmas form={form} update={update} />
        </section>
      </main>

      <div className="md:hidden fixed bottom-4 inset-x-0 px-4 z-40">
        <button onClick={generateDoc} className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-lg shadow-lg active:scale-[0.99]">
          GENERAR DOC
        </button>
      </div>

      <div className="hidden md:flex justify-center pb-8">
        <button onClick={generateDoc} className="px-10 py-4 rounded-2xl bg-blue-600 text-white font-bold text-xl hover:bg-blue-700 shadow-lg">
          GENERAR DOC
        </button>
      </div>
    </div>
  );
}
