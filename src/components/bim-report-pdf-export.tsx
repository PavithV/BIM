'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Printer,
  FileText,
  ShieldCheck,
  Leaf,
  LayoutGrid,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
} from 'lucide-react';
import type { IFCModel } from '@/lib/types';
import type { FullModelAnalysis } from '@/utils/modelChecker';
import { tr, type Language } from '@/lib/i18n';

interface BimReportPdfExportProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  activeProject: IFCModel | null;
  modelAnalysis: FullModelAnalysis | null;
}

// ─────────────────────────────────────────────
// Tiny helpers
// ─────────────────────────────────────────────
function fmt(v: number | undefined | null, unit: string): string {
  if (v === undefined || v === null || v === 0) return '—';
  return `${v.toFixed(2)} ${unit}`;
}

function fmtCurrency(v: number, lang: Language): string {
  return new Intl.NumberFormat(lang === 'en' ? 'en-US' : lang === 'fr' ? 'fr-FR' : 'de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);
}

// ─────────────────────────────────────────────
// Status icon helpers (SVG strings for print)
// ─────────────────────────────────────────────
type Status = 'ok' | 'warn' | 'error';

function StatusDot({ status }: { status: Status }) {
  const color = status === 'ok' ? '#22c55e' : status === 'warn' ? '#eab308' : '#ef4444';
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: color,
        marginRight: 6,
        flexShrink: 0,
        verticalAlign: 'middle',
      }}
    />
  );
}

// KG colour table (same as din276-tab)
const KG_COLORS: Record<string, string> = {
  '320': '#78716c',
  '330': '#3b82f6',
  '334': '#0ea5e9',
  '340': '#f59e0b',
  '344': '#f97316',
  '350': '#a855f7',
  '360': '#f43f5e',
  '370': '#10b981',
  '380': '#14b8a6',
  '390': '#84cc16',
};
function kgColor(kg: string): string {
  return KG_COLORS[kg] ?? '#6b7280';
}

function translateKgLabel(language: Language, label: string): string {
  if (language === 'de') return label;
  if (language === 'fr') {
    const mapFr: Record<string, string> = {
      'Baugrube / Erdbau': 'Fouille / terrassement',
      'Gründung': 'Fondation',
      'Außenwände': 'Murs extérieurs',
      'Außentüren und -fenster': 'Portes et fenêtres extérieures',
      'Innenwände': 'Murs intérieurs',
      'Innentüren und -fenster': 'Portes et fenêtres intérieures',
      'Decken': 'Dalles et plafonds',
      'Dächer': 'Toitures',
      'Infrastrukturanlagen': 'Installations d\'infrastructure',
      'Baukonstruktive Einbauten': 'Éléments structurels intégrés',
      'Sonstige Maßnahmen': 'Autres mesures',
    };
    return mapFr[label] ?? label;
  }
  const map: Record<string, string> = {
    'Baugrube / Erdbau': 'Excavation / earthworks',
    'Gründung': 'Foundation',
    'Außenwände': 'Exterior walls',
    'Außentüren und -fenster': 'Exterior doors and windows',
    'Innenwände': 'Interior walls',
    'Innentüren und -fenster': 'Interior doors and windows',
    'Decken': 'Slabs and ceilings',
    'Dächer': 'Roofs',
    'Infrastrukturanlagen': 'Infrastructure systems',
    'Baukonstruktive Einbauten': 'Structural built-in components',
    'Sonstige Maßnahmen': 'Other measures',
  };
  return map[label] ?? label;
}

// ─────────────────────────────────────────────
// The main export component
// ─────────────────────────────────────────────
export function BimReportPdfExport({
  isOpen,
  onOpenChange,
  language,
  activeProject,
  modelAnalysis,
}: BimReportPdfExportProps) {
  const [sectionsToInclude, setSectionsToInclude] = useState({
    modelCheck: true,
    sustainability: true,
    din277: true,
    din276: true,
  });

  const toggle = (key: keyof typeof sectionsToInclude) =>
    setSectionsToInclude((prev) => ({ ...prev, [key]: !prev[key] }));

  const mc = modelAnalysis?.modelCheck ?? null;
  const din277 = modelAnalysis?.din277 ?? null;
  const din276 = modelAnalysis?.din276 ?? null;
  const analysis = activeProject?.analysisData ?? null;

  // ── print handler ──────────────────────────
  const handlePrint = () => {
    const el = document.getElementById('bim-report-printable');
    if (!el) return;

    const pw = window.open('', '_blank', 'width=794,height=1200');
    if (!pw) {
      alert('Bitte Pop-ups für diese Seite erlauben und erneut versuchen.');
      return;
    }

    const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((l) => l.outerHTML)
      .join('\n');
    const styleTags = Array.from(document.querySelectorAll('style'))
      .filter((s) => !s.textContent?.includes('#bim-report-printable'))
      .map((s) => s.outerHTML)
      .join('\n');

    pw.document.open();
    pw.document.write(`<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <title>BIM Report – ${activeProject?.fileName ?? 'Bericht'}</title>
  ${linkTags}
  ${styleTags}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0 !important; padding: 0 !important;
      background: white !important;
      width: 210mm;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: A4 portrait; margin: 12mm 14mm; }
    .page-break { page-break-before: always !important; break-before: page !important; }
    table { border-collapse: collapse; width: 100%; }
    td, th { padding: 5px 8px; font-size: 10px; }
  </style>
</head>
<body style="margin:0;padding:0;">
  ${el.innerHTML}
</body>
</html>`);
    pw.document.close();

    pw.addEventListener('load', () => {
      pw.focus();
      pw.print();
      pw.close();
    });
    setTimeout(() => {
      if (pw && !pw.closed) { pw.focus(); pw.print(); }
    }, 1500);
  };

  // ── derived totals for model check ──────────
  const totalElements = mc?.materialChecks.reduce((s, c) => s + c.total, 0) ?? 0;
  const totalWithout = mc?.materialChecks.reduce((s, c) => s + c.withoutMaterial, 0) ?? 0;
  const matStatus: Status =
    totalElements === 0 ? 'warn' : totalWithout === 0 ? 'ok' : totalWithout > totalElements * 0.3 ? 'error' : 'warn';
  const obdStatus: Status =
    !mc || mc.totalIfcMaterials === 0
      ? 'warn'
      : mc.obdMatchCount === mc.totalIfcMaterials
      ? 'ok'
      : mc.obdMatchCount > 0
      ? 'warn'
      : 'error';
  const spaceStatus: Status =
    !mc ? 'warn' : !mc.spacesExist ? 'error' : mc.unnamedSpaceCount > 0 ? 'warn' : 'ok';

  const today = new Date().toLocaleDateString(language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : 'en-US');

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[92vh] flex flex-col p-0 overflow-hidden bg-background border shadow-2xl rounded-2xl">
        <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-xl font-bold font-headline flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary animate-pulse" />
              {tr(language, 'BIM-Bericht exportieren', 'Export BIM Report', 'Exporter le rapport BIM')}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeProject?.fileName ?? ''}
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* ─── Left sidebar: options ─── */}
          <div className="w-[280px] border-r bg-card flex flex-col shrink-0 overflow-y-auto p-5 space-y-5">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground mb-3">
                {tr(language, 'Abschnitte auswählen', 'Select sections', 'Sélectionner les sections')}
              </h3>
              <div className="space-y-2">
                {[
                  {
                    key: 'modelCheck' as const,
                    label: tr(language, 'Modellprüfung', 'Model check', 'Vérification du modèle'),
                    icon: <ShieldCheck className="w-4 h-4 text-primary" />,
                    available: !!mc,
                  },
                  {
                    key: 'sustainability' as const,
                    label: tr(language, 'Nachhaltigkeitsanalyse', 'Sustainability analysis', 'Analyse de durabilité'),
                    icon: <Leaf className="w-4 h-4 text-emerald-500" />,
                    available: !!analysis,
                  },
                  {
                    key: 'din277' as const,
                    label: tr(language, 'DIN 277 Flächen', 'DIN 277 Areas', 'DIN 277 Surfaces'),
                    icon: <LayoutGrid className="w-4 h-4 text-blue-500" />,
                    available: !!(din277 && din277.spaces.length > 0),
                  },
                  {
                    key: 'din276' as const,
                    label: tr(language, 'DIN 276 Mengen', 'DIN 276 Quantities', 'DIN 276 Quantités'),
                    icon: <Layers className="w-4 h-4 text-amber-500" />,
                    available: !!(din276 && din276.groups.length > 0),
                  },
                ].map(({ key, label, icon, available }) => (
                  <button
                    key={key}
                    onClick={() => available && toggle(key)}
                    disabled={!available}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all border ${
                      !available
                        ? 'opacity-40 cursor-not-allowed border-border text-muted-foreground'
                        : sectionsToInclude[key]
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'border-border text-foreground hover:bg-muted/50'
                    }`}
                  >
                    {icon}
                    <span className="flex-1 text-left">{label}</span>
                    {!available && (
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {tr(language, 'N/A', 'N/A')}
                      </span>
                    )}
                    {available && (
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          sectionsToInclude[key]
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground/30'
                        }`}
                      >
                        {sectionsToInclude[key] && (
                          <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-white" fill="currentColor">
                            <path d="M1 5l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t space-y-2 mt-auto">
              <Button
                onClick={handlePrint}
                className="w-full h-11 font-bold flex items-center justify-center gap-2 shadow-lg transition-all duration-300"
              >
                <Printer className="w-5 h-5" />
                {tr(language, 'PDF drucken / speichern', 'Print / Save PDF', 'Imprimer / Enregistrer PDF')}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full h-9 font-medium">
                {tr(language, 'Schließen', 'Close', 'Fermer')}
              </Button>
            </div>
          </div>

          {/* ─── Right: Live preview ─── */}
          <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
            {/* The printable content is also shown in preview */}
            <div
              id="bim-report-printable"
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                color: '#0f172a',
                background: '#fff',
                maxWidth: 794,
                margin: '0 auto',
              }}
            >
              {/* ── Cover header ── */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                  color: '#fff',
                  padding: '32px 36px 28px',
                  marginBottom: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, marginBottom: 6 }}>
                      BIMCoach Studio · {tr(language, 'Projektbericht', 'Project Report', 'Rapport de projet')}
                    </p>
                    <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                      {tr(language, 'BIM-Analyse & Qualitätsbericht', 'BIM Analysis & Quality Report', 'Analyse BIM et rapport qualité')}
                    </h1>
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontWeight: 600 }}>
                      {activeProject?.fileName ?? '—'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{today}</p>
                    <p style={{ margin: 0 }}>IFC · DIN 277 · DIN 276</p>
                  </div>
                </div>

                {/* Section pills */}
                <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
                  {sectionsToInclude.modelCheck && (
                    <span style={{ background: 'rgba(255,255,255,0.12)', color: '#e2e8f0', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 99 }}>
                      {tr(language, 'Modellprüfung', 'Model check', 'Vérification du modèle')}
                    </span>
                  )}
                  {sectionsToInclude.sustainability && (
                    <span style={{ background: 'rgba(255,255,255,0.12)', color: '#e2e8f0', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 99 }}>
                      {tr(language, 'Nachhaltigkeit', 'Sustainability', 'Durabilité')}
                    </span>
                  )}
                  {sectionsToInclude.din277 && (
                    <span style={{ background: 'rgba(255,255,255,0.12)', color: '#e2e8f0', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 99 }}>
                      DIN 277
                    </span>
                  )}
                  {sectionsToInclude.din276 && (
                    <span style={{ background: 'rgba(255,255,255,0.12)', color: '#e2e8f0', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 99 }}>
                      DIN 276
                    </span>
                  )}
                </div>
              </div>

              {/* ══════════════════════════════════════════
                  SECTION 1: Modellprüfung
              ══════════════════════════════════════════ */}
              {sectionsToInclude.modelCheck && (
                <div style={{ padding: '28px 36px', borderBottom: '2px solid #e2e8f0' }}>
                  <SectionHeading icon="🔍" title={tr(language, 'Modellprüfung', 'Model check', 'Vérification du modèle')} color="#6366f1" />

                  {!mc ? (
                    <NoData language={language} />
                  ) : (
                    <>
                      {/* IFC Version */}
                      <SubHeading title={tr(language, 'IFC-Version & Metadaten', 'IFC Version & Metadata', 'Version IFC et métadonnées')} />
                      <table style={{ marginBottom: 16 }}>
                        <tbody>
                          <tr>
                            <TdLabel>{tr(language, 'Schema', 'Schema', 'Schéma')}</TdLabel>
                            <TdValue>{mc.ifcVersion ?? '—'}</TdValue>
                            <TdLabel>{tr(language, 'Projekt', 'Project', 'Projet')}</TdLabel>
                            <TdValue>{mc.projectName ?? '—'}</TdValue>
                          </tr>
                          {mc.creationDate && (
                            <tr>
                              <TdLabel>{tr(language, 'Erstellt am', 'Created on', 'Créé le')}</TdLabel>
                              <TdValue colSpan={3}>{mc.creationDate}</TdValue>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      {/* Räume */}
                      <SubHeading title={tr(language, 'Räume (IfcSpace)', 'Spaces (IfcSpace)', 'Espaces (IfcSpace)')} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 11 }}>
                        <StatusDot status={spaceStatus} />
                        {mc.spacesExist ? (
                          <span>
                            <strong>{mc.spaceCount}</strong> {tr(language, 'Räume gefunden', 'spaces found', 'espaces trouvés')}
                            {mc.unnamedSpaceCount > 0 && (
                              <span style={{ color: '#ca8a04', marginLeft: 8 }}>
                                ({mc.unnamedSpaceCount} {tr(language, 'ohne Namen', 'unnamed', 'sans nom')})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>
                            {tr(language, 'Keine IfcSpace-Entitäten vorhanden!', 'No IfcSpace entities found!', 'Aucune entité IfcSpace trouvée !')}
                          </span>
                        )}
                      </div>

                      {/* Materialzuordnung */}
                      <SubHeading title={tr(language, 'Materialzuordnung', 'Material assignment', 'Attribution des matériaux')} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 11 }}>
                        <StatusDot status={matStatus} />
                        <span>
                          <strong>{totalElements - totalWithout}</strong> / {totalElements}{' '}
                          {tr(language, 'Bauteile mit Material', 'components with material', 'composants avec matériau')}
                        </span>
                      </div>
                      {mc.materialChecks.length > 0 && (
                        <table style={{ marginBottom: 16, fontSize: 10 }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                              <Th>{tr(language, 'Bauteiltyp', 'Component type', 'Type de composant')}</Th>
                              <Th right>{tr(language, 'Mit Material', 'With material', 'Avec matériau')}</Th>
                              <Th right>{tr(language, 'Ohne Material', 'Without material', 'Sans matériau')}</Th>
                              <Th right>{tr(language, 'Gesamt', 'Total', 'Total')}</Th>
                              <Th right>%</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {mc.materialChecks.map((c) => {
                              const pct = c.total > 0 ? Math.round((c.withMaterial / c.total) * 100) : 100;
                              return (
                                <tr key={c.elementType} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{c.elementType}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>{c.withMaterial}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'right', color: c.withoutMaterial > 0 ? '#dc2626' : '#6b7280' }}>{c.withoutMaterial}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{c.total}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: pct === 100 ? '#16a34a' : pct < 70 ? '#dc2626' : '#ca8a04' }}>{pct}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}

                      {/* OBD Match */}
                      <SubHeading title={tr(language, 'Ökobaudat-Verknüpfung', 'Ökobaudat linkage', 'Liaison Ökobaudat')} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 11 }}>
                        <StatusDot status={obdStatus} />
                        <span>
                          <strong>{mc.obdMatchCount}</strong> / {mc.totalIfcMaterials}{' '}
                          {tr(language, 'Materialien verknüpft', 'materials linked', 'matériaux liés')}
                        </span>
                      </div>
                      {mc.matchingMaterials && mc.matchingMaterials.length > 0 && (
                        <p style={{ fontSize: 9, color: '#16a34a', marginBottom: 4 }}>
                          ✓ {mc.matchingMaterials.join(', ')}
                        </p>
                      )}
                      {mc.unmatchedMaterials && mc.unmatchedMaterials.length > 0 && (
                        <p style={{ fontSize: 9, color: '#ca8a04' }}>
                          ⚠ {mc.unmatchedMaterials.join(', ')}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════
                  SECTION 2: Nachhaltigkeitsanalyse
              ══════════════════════════════════════════ */}
              {sectionsToInclude.sustainability && (
                <div style={{ padding: '28px 36px', borderBottom: '2px solid #e2e8f0' }}>
                  <SectionHeading icon="🌱" title={tr(language, 'Nachhaltigkeitsanalyse', 'Sustainability analysis', 'Analyse de durabilité')} color="#10b981" />

                  {!analysis ? (
                    <NoData language={language} />
                  ) : (
                    <>
                      {/* Summary */}
                      <SubHeading title={tr(language, 'Zusammenfassung', 'Summary', 'Résumé')} />
                      <p style={{ fontSize: 11, lineHeight: 1.6, color: '#475569', marginBottom: 16, background: '#f8fafc', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid #10b981' }}>
                        {analysis.summary}
                      </p>

                      {/* Indicators */}
                      {analysis.indicators.length > 0 && (
                        <>
                          <SubHeading title={tr(language, 'Kennwerte', 'Key indicators', 'Indicateurs clés')} />
                          <table style={{ marginBottom: 16 }}>
                            <thead>
                              <tr style={{ background: '#f1f5f9' }}>
                                <Th>{tr(language, 'Indikator', 'Indicator', 'Indicateur')}</Th>
                                <Th right>{tr(language, 'Wert', 'Value', 'Valeur')}</Th>
                                <Th>{tr(language, 'Einheit', 'Unit', 'Unité')}</Th>
                                <Th>{tr(language, 'Lebensphase', 'Life phase', 'Phase de vie')}</Th>
                                <Th>{tr(language, 'Bewertung', 'Rating', 'Évaluation')}</Th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysis.indicators.map((ind, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '4px 8px', fontSize: 10 }}>{ind.name}</td>
                                  <td style={{ padding: '4px 8px', fontSize: 10, textAlign: 'right', fontWeight: 700 }}>{ind.value}</td>
                                  <td style={{ padding: '4px 8px', fontSize: 10 }}>{ind.unit}</td>
                                  <td style={{ padding: '4px 8px', fontSize: 10, fontFamily: 'monospace' }}>{ind.a}</td>
                                  <td style={{ padding: '4px 8px', fontSize: 10, color: ind.rating === 'low' ? '#16a34a' : ind.rating === 'medium' ? '#ca8a04' : '#dc2626', fontWeight: 700 }}>
                                    {ind.rating === 'low' ? '↓ ' : ind.rating === 'medium' ? '→ ' : '↑ '}
                                    {ind.rating === 'low' ? tr(language, 'Niedrig', 'Low', 'Faible') : ind.rating === 'medium' ? tr(language, 'Mittel', 'Medium', 'Moyen') : tr(language, 'Hoch', 'High', 'Élevé')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      )}

                      {/* Material composition */}
                      {analysis.materialComposition.length > 0 && (
                        <>
                          <SubHeading title={tr(language, 'Materialzusammensetzung', 'Material composition', 'Composition des matériaux')} />
                          <table style={{ marginBottom: 4 }}>
                            <thead>
                              <tr style={{ background: '#f1f5f9' }}>
                                <Th>{tr(language, 'Material', 'Material', 'Matériau')}</Th>
                                <Th right>{tr(language, 'Anteil (%)', 'Share (%)', 'Part (%)')}</Th>
                                <Th right>{tr(language, 'Verteilung', 'Distribution', 'Distribution')}</Th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysis.materialComposition.map((mat, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '4px 8px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: mat.fill ?? '#6b7280', flexShrink: 0 }} />
                                    {mat.name}
                                  </td>
                                  <td style={{ padding: '4px 8px', fontSize: 10, textAlign: 'right', fontWeight: 700 }}>{mat.value}</td>
                                  <td style={{ padding: '4px 8px', fontSize: 10 }}>
                                    <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', minWidth: 80 }}>
                                      <div style={{ height: '100%', width: `${Math.min(100, mat.value)}%`, background: mat.fill ?? '#6b7280', borderRadius: 4 }} />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════
                  SECTION 3: DIN 277
              ══════════════════════════════════════════ */}
              {sectionsToInclude.din277 && (
                <div style={{ padding: '28px 36px', borderBottom: '2px solid #e2e8f0' }}>
                  <SectionHeading icon="📐" title={tr(language, 'DIN 277 Flächenauswertung', 'DIN 277 Area Evaluation', 'Évaluation des surfaces DIN 277')} color="#3b82f6" />

                  {!din277 || din277.spaces.length === 0 ? (
                    <NoData language={language} />
                  ) : (
                    <>
                      {/* Summary KPIs */}
                      <SubHeading title={tr(language, 'Flächenkennwerte', 'Area key figures', 'Indicateurs de surface')} />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
                        {[
                          { label: 'BGF', sub: tr(language, 'Bruttogrundfläche', 'Gross floor area', 'Surface brute de plancher'), val: din277.summary.bgf, color: '#1e293b' },
                          { label: 'NRF', sub: tr(language, 'Nettoraumfläche', 'Net room area', 'Surface nette'), val: din277.summary.nrf, color: '#1e293b' },
                          { label: 'NUF', sub: tr(language, 'Nutzungsfläche', 'Usable area', 'Surface utile'), val: din277.summary.nuf, color: '#3b82f6' },
                          { label: 'VF', sub: tr(language, 'Verkehrsfläche', 'Circulation area', 'Surface de circulation'), val: din277.summary.vf, color: '#f59e0b' },
                          { label: 'TF', sub: tr(language, 'Technikfläche', 'Technical area', 'Surface technique'), val: din277.summary.tf, color: '#a855f7' },
                        ].map(({ label, sub, val, color }) => (
                          <div key={label} style={{ border: `2px solid ${color}30`, borderRadius: 8, padding: '10px 12px', background: `${color}08` }}>
                            <p style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px' }}>{label}</p>
                            <p style={{ fontSize: 14, fontWeight: 900, color, margin: '0 0 2px' }}>{val != null ? `${val.toFixed(1)} m²` : '—'}</p>
                            <p style={{ fontSize: 8, color: '#64748b', margin: 0 }}>{sub}</p>
                          </div>
                        ))}
                      </div>

                      {/* Space table */}
                      <SubHeading title={tr(language, `Raumdetails (${din277.spaces.length} Räume)`, `Room details (${din277.spaces.length} rooms)`, `Détails des pièces (${din277.spaces.length} pièces)`)} />
                      <table style={{ marginBottom: 4, fontSize: 10 }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9' }}>
                            <Th>{tr(language, 'Name', 'Name', 'Nom')}</Th>
                            <Th>{tr(language, 'Kategorie', 'Category', 'Catégorie')}</Th>
                            <Th right>NGA (m²)</Th>
                            <Th right>BGA (m²)</Th>
                            <Th right>{tr(language, 'Volumen (m³)', 'Volume (m³)', 'Volume (m³)')}</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {din277.spaces.slice(0, 40).map((sp) => (
                            <tr key={sp.expressID} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '3px 8px' }}>{sp.name || sp.longName || `#${sp.expressID}`}</td>
                              <td style={{ padding: '3px 8px' }}>
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: sp.din277Category === 'NUF' ? '#dbeafe' : sp.din277Category === 'VF' ? '#fef3c7' : '#f3e8ff', color: sp.din277Category === 'NUF' ? '#1d4ed8' : sp.din277Category === 'VF' ? '#92400e' : '#7c3aed' }}>
                                  {sp.din277Category}
                                </span>
                              </td>
                              <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{sp.netFloorArea != null ? sp.netFloorArea.toFixed(2) : '—'}</td>
                              <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{sp.grossFloorArea != null ? sp.grossFloorArea.toFixed(2) : '—'}</td>
                              <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{sp.volume != null ? sp.volume.toFixed(2) : '—'}</td>
                            </tr>
                          ))}
                          {din277.spaces.length > 40 && (
                            <tr>
                              <td colSpan={5} style={{ padding: '4px 8px', fontSize: 9, color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>
                                ... {din277.spaces.length - 40} {tr(language, 'weitere Räume (im UI sichtbar)', 'more rooms (visible in UI)', 'pièces supplémentaires (visibles dans l\'interface)')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#1e293b', color: '#fff', fontWeight: 800 }}>
                            <td colSpan={2} style={{ padding: '5px 8px', fontSize: 10 }}>{tr(language, 'Summe', 'Total', 'Total')}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 10 }}>
                              {din277.summary.nrf != null ? din277.summary.nrf.toFixed(2) : '—'}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 10 }}>
                              {din277.summary.bgf != null ? din277.summary.bgf.toFixed(2) : '—'}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 10 }}>
                              {din277.spaces.reduce((s, sp) => s + (sp.volume ?? 0), 0).toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════
                  SECTION 4: DIN 276
              ══════════════════════════════════════════ */}
              {sectionsToInclude.din276 && (
                <div style={{ padding: '28px 36px' }}>
                  <SectionHeading icon="💶" title={tr(language, 'DIN 276 Mengenauswertung', 'DIN 276 Quantity Evaluation', 'Évaluation quantitative DIN 276')} color="#f59e0b" />

                  {!din276 || din276.groups.length === 0 ? (
                    <NoData language={language} />
                  ) : (
                    <>
                      {/* Total cost banner */}
                      <div style={{ background: 'linear-gradient(135deg, #1e293b, #334155)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>
                            {tr(language, 'Geschätzte Gesamtbaukosten (KG 300)', 'Estimated total construction costs (KG 300)', 'Coûts de construction totaux estimés (KG 300)')}
                          </p>
                          <p style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
                            {fmtCurrency(din276.totalCost, language)}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 9, color: '#64748b', margin: '0 0 2px' }}>{tr(language, 'Basierend auf BKI-Mittelwerten', 'Based on BKI averages', 'Basé sur les moyennes BKI')}</p>
                          <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, margin: 0 }}>
                            {din276.totalArea.toFixed(0)} m² · {din276.totalVolume.toFixed(0)} m³
                          </p>
                        </div>
                      </div>

                      {/* Cost groups table */}
                      <SubHeading title={tr(language, 'Kostengruppen nach DIN 276', 'Cost groups per DIN 276', 'Groupes de coûts selon DIN 276')} />
                      <table style={{ marginBottom: 16, fontSize: 10 }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9' }}>
                            <Th>{tr(language, 'KG', 'CG', 'GC')}</Th>
                            <Th>{tr(language, 'Bezeichnung', 'Description', 'Désignation')}</Th>
                            <Th right>{tr(language, 'Bauteile', 'Components', 'Composants')}</Th>
                            <Th right>{tr(language, 'Fläche/Volumen', 'Area/Volume', 'Surface/Volume')}</Th>
                            <Th right>{tr(language, 'Einheitspreis', 'Unit price', 'Prix unitaire')}</Th>
                            <Th right>{tr(language, 'Kosten', 'Costs', 'Coûts')}</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {din276.groups.map((g) => (
                            <tr key={g.kg} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '4px 8px' }}>
                                <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 99, fontSize: 9, fontWeight: 800, background: `${kgColor(g.kg)}20`, color: kgColor(g.kg), fontFamily: 'monospace', border: `1px solid ${kgColor(g.kg)}40` }}>
                                  {g.kg}
                                </span>
                              </td>
                              <td style={{ padding: '4px 8px', fontWeight: 600 }}>{translateKgLabel(language, g.label)}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{g.elementCount}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                                {g.totalArea > 0 ? fmt(g.totalArea, 'm²') : fmt(g.totalVolume, 'm³')}
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>
                                {g.unitPrice > 0 ? `${g.unitPrice} €/${g.unit}` : '—'}
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>
                                {fmtCurrency(g.totalCost, language)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#1e293b', color: '#fff', fontWeight: 900 }}>
                            <td colSpan={5} style={{ padding: '6px 8px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {tr(language, 'Gesamtkosten KG 300', 'Total costs KG 300', 'Coûts totaux KG 300')}
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                              {fmtCurrency(din276.totalCost, language)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </>
                  )}
                </div>
              )}

              {/* ── Report footer ── */}
              <div style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', padding: '12px 36px', display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                <span>BIMCoach Studio © 2026</span>
                <span>IFC · DIN 277 · DIN 276 · GWP</span>
                <span>{today}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Tiny layout sub-components used above
// ─────────────────────────────────────────────
function SectionHeading({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: `2px solid ${color}` }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <h2 style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>{title}</h2>
    </div>
  );
}

function SubHeading({ title }: { title: string }) {
  return (
    <h3 style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px', paddingBottom: 4, borderBottom: '1px solid #e2e8f0' }}>
      {title}
    </h3>
  );
}

function TdLabel({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, color: '#64748b', background: '#f8fafc', whiteSpace: 'nowrap' }}>{children}</td>;
}

function TdValue({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600 }}>{children}</td>;
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{ padding: '5px 8px', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#374151', textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  );
}

function NoData({ language }: { language: Language }) {
  return (
    <p style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', padding: '12px 0' }}>
      {tr(language, 'Keine Daten verfügbar – bitte Analyse zuerst ausführen.', 'No data available – please run analysis first.', 'Aucune donnée disponible – veuillez d\'abord lancer l\'analyse.')}
    </p>
  );
}
