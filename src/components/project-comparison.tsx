'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts';
import { ChartContainer, ChartConfig } from '@/components/ui/chart';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Minus,
  Euro,
  Leaf,
  Recycle,
  Layers,
  Award,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { IFCModel } from '@/lib/types';
import type { FullModelAnalysis } from '@/utils/modelChecker';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ProjectComparisonProps {
  projects: IFCModel[];
  projectA: IFCModel | null;
  projectB: IFCModel | null;
  onSelectProjectA: (project: IFCModel | null) => void;
  onSelectProjectB: (project: IFCModel | null) => void;
  /** Lokale Modellanalyse des aktiven Projekts – wird als Fallback für Kostendaten genutzt */
  activeProjectId?: string | null;
  activeModelAnalysis?: FullModelAnalysis | null;
}

interface ComparisonMetrics {
  totalCost: number;
  co2Emissions: number;
  recyclingRate: number;
  totalElements: number;
  sustainabilityScore: number;
}

// Extrahiere Zahlenwerte aus formatierten Strings
// Unterstützt deutsche ("1.234.567 €", "218.000 €") und englische ("€1,234,567") Formate
// inkl. Intl.NumberFormat-Sonderzeichen: \u00a0, \u202f (non-breaking spaces)
const extractNumber = (value: string): number => {
  if (!value) return 0;

  // Entferne Währungssymbol und alle Arten von Leerzeichen (inkl. \u00a0, \u202f)
  let cleaned = value.replace(/[€$£\u00a0\u202f\s]/g, '');

  if (!cleaned) return 0;

  const dotCount   = (cleaned.match(/\./g) ?? []).length;
  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const lastDot    = cleaned.lastIndexOf('.');
  const lastComma  = cleaned.lastIndexOf(',');

  if (dotCount > 1) {
    // Mehrere Punkte = deutsches Tausender-Format: "1.234.567" oder "1.234.567,50"
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (commaCount > 1) {
    // Mehrere Kommas = englisches Tausender-Format: "1,234,567" oder "1,234,567.50"
    cleaned = cleaned.replace(/,/g, '');
  } else if (lastDot > lastComma) {
    // Einzelner Punkt: Prüfe ob genau 3 Ziffern dahinter → deutsches Tausender-Trennzeichen
    // z.B. "218.000" = 218.000 (DE) vs. "218.50" = 218.50 (EN)
    const afterDot = cleaned.slice(lastDot + 1);
    if (commaCount === 0 && afterDot.length === 3 && /^\d{3}$/.test(afterDot)) {
      // "218.000" → 218000 (deutsches Format ohne Dezimalstellen)
      cleaned = cleaned.replace(/\./g, '');
    } else {
      // "1234.56" / "1,234.56" → englischer Dezimalpunkt
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (lastComma > lastDot) {
    // Einzelnes Komma nach dem Punkt oder ohne Punkt = deutsches Dezimalkomma: "1234,56" / "1.234,56"
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Keine Trennzeichen → reine Zahl: "218000"
    cleaned = cleaned.replace(/[^\d]/g, '');
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};


const normalize = (value: number, min: number, max: number): number => {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
};

const calculateMetrics = (
  project: IFCModel | null,
  allProjects: IFCModel[],
  din276Fallback?: { projectId: string; totalCost: number } | null
): ComparisonMetrics | null => {
  if (!project || !project.analysisData) return null;

  let totalCost = 0;
  if (project.costEstimationData?.totalEstimatedCost) {
    totalCost = extractNumber(project.costEstimationData.totalEstimatedCost);
  } else if (din276Fallback && din276Fallback.projectId === project.id && din276Fallback.totalCost > 0) {
    // Fallback: DIN 276 Kosten aus lokalem State (noch nicht in DB persistiert)
    totalCost = din276Fallback.totalCost;
  }

  let co2Emissions = 0;
  const gwpIndicator = project.analysisData.indicators.find(
    (ind) => ind.name.toLowerCase().includes('erderwärmung') || ind.name.toLowerCase().includes('gwp')
  );
  if (gwpIndicator) {
    co2Emissions = extractNumber(gwpIndicator.value);
  }

  let recyclingRate = 0;
  const recyclingIndicator = project.analysisData.indicators.find(
    (ind) => ind.name.toLowerCase().includes('recycelt') || ind.name.toLowerCase().includes('recycling')
  );
  if (recyclingIndicator) {
    recyclingRate = extractNumber(recyclingIndicator.value);
  }

  const totalElements = project.analysisData.materialComposition.reduce((sum, mat) => sum + mat.value, 0);

  const allCosts = allProjects
    .map((p) => (p.costEstimationData?.totalEstimatedCost ? extractNumber(p.costEstimationData.totalEstimatedCost) : 0))
    .filter((c) => c > 0);
  const allCO2 = allProjects
    .map((p) => {
      const gwp = p.analysisData?.indicators?.find(
        (ind) => ind.name.toLowerCase().includes('erderwärmung') || ind.name.toLowerCase().includes('gwp')
      );
      return gwp ? extractNumber(gwp.value) : 0;
    })
    .filter((c) => c > 0);

  const minCost = allCosts.length > 0 ? Math.min(...allCosts) : totalCost;
  const maxCost = allCosts.length > 0 ? Math.max(...allCosts) : totalCost || 1_000_000;
  const minCO2 = allCO2.length > 0 ? Math.min(...allCO2) : co2Emissions;
  const maxCO2 = allCO2.length > 0 ? Math.max(...allCO2) : co2Emissions || 1000;

  const normalizedCO2 = normalize(co2Emissions, minCO2, maxCO2);
  const normalizedCost = normalize(totalCost, minCost, maxCost);
  const sustainabilityScore =
    0.5 * (1 - normalizedCO2) + 0.3 * (recyclingRate / 100) + 0.2 * (1 - normalizedCost);

  return {
    totalCost,
    co2Emissions,
    recyclingRate,
    totalElements,
    sustainabilityScore: sustainabilityScore * 100,
  };
};

const calculateDifferences = (
  metricsA: ComparisonMetrics | null,
  metricsB: ComparisonMetrics | null
) => {
  if (!metricsA || !metricsB) return null;

  const calculateDiff = (a: number, b: number) => {
    const absolute = b - a;
    const percentage = a !== 0 ? (absolute / a) * 100 : b !== 0 ? 100 : 0;
    return { absolute, percentage };
  };

  return {
    totalCost: calculateDiff(metricsA.totalCost, metricsB.totalCost),
    co2Emissions: calculateDiff(metricsA.co2Emissions, metricsB.co2Emissions),
    recyclingRate: calculateDiff(metricsA.recyclingRate, metricsB.recyclingRate),
    totalElements: calculateDiff(metricsA.totalElements, metricsB.totalElements),
    sustainabilityScore: calculateDiff(metricsA.sustainabilityScore, metricsB.sustainabilityScore),
  };
};

const isImprovement = (metric: string, difference: number): boolean => {
  switch (metric) {
    case 'totalCost':
    case 'co2Emissions':
      return difference < 0;
    case 'recyclingRate':
    case 'sustainabilityScore':
      return difference > 0;
    default:
      return false;
  }
};

// ─── Subcomponents ──────────────────────────────────────────────────────────

function DeltaBadge({
  value,
  percentage,
  metricKey,
  unit,
}: {
  value: number;
  percentage: number;
  metricKey: string;
  unit: string;
}) {
  const improved = isImprovement(metricKey, value);
  const neutral = value === 0;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        neutral
          ? 'bg-muted text-muted-foreground'
          : improved
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
      )}
    >
      {neutral ? (
        <Minus className="w-3 h-3" />
      ) : improved ? (
        <TrendingDown className="w-3 h-3" />
      ) : (
        <TrendingUp className="w-3 h-3" />
      )}
      <span>
        {value >= 0 ? '+' : ''}
        {Math.abs(percentage) > 999 ? '—' : percentage.toFixed(1)}%
      </span>
    </div>
  );
}

function MetricRow({
  label,
  icon,
  valueA,
  valueB,
  unit,
  metricKey,
  difference,
  formatValue,
  noDataA,
  noDataB,
}: {
  label: string;
  icon: React.ReactNode;
  valueA: number;
  valueB: number;
  unit: string;
  metricKey: string;
  difference: { absolute: number; percentage: number } | null;
  formatValue?: (v: number) => string;
  noDataA?: boolean;
  noDataB?: boolean;
}) {
  const fmt = formatValue ?? ((v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 2 }));
  const max = Math.max(valueA, valueB, 1);
  const barA = (valueA / max) * 100;
  const barB = (valueB / max) * 100;

  const aWins =
    metricKey === 'totalCost' || metricKey === 'co2Emissions'
      ? valueA < valueB
      : metricKey === 'recyclingRate' || metricKey === 'sustainabilityScore'
      ? valueA > valueB
      : false;
  const bWins =
    metricKey === 'totalCost' || metricKey === 'co2Emissions'
      ? valueB < valueA
      : metricKey === 'recyclingRate' || metricKey === 'sustainabilityScore'
      ? valueB > valueA
      : false;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {label}
        </div>
        {difference && (
          <DeltaBadge
            value={difference.absolute}
            percentage={difference.percentage}
            metricKey={metricKey}
            unit={unit}
          />
        )}
      </div>

      {/* Values */}
      <div className="grid grid-cols-2 gap-3">
        {/* Project A */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-widest',
                'text-blue-600 dark:text-blue-400'
              )}
            >
              Projekt A
            </span>
            {aWins && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          </div>
          <p className="text-xl font-bold leading-none">
            {noDataA ? (
              <span className="text-sm font-normal text-muted-foreground italic">Nicht verfügbar</span>
            ) : (
              <>{fmt(valueA)}<span className="text-xs font-normal text-muted-foreground ml-1">{unit}</span></>
            )}
          </p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-700"
              style={{ width: noDataA ? '0%' : `${barA}%` }}
            />
          </div>
        </div>

        {/* Project B */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-widest',
                'text-violet-600 dark:text-violet-400'
              )}
            >
              Projekt B
            </span>
            {bWins && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          </div>
          <p className="text-xl font-bold leading-none">
            {noDataB ? (
              <span className="text-sm font-normal text-muted-foreground italic">Nicht verfügbar</span>
            ) : (
              <>{fmt(valueB)}<span className="text-xs font-normal text-muted-foreground ml-1">{unit}</span></>
            )}
          </p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-700"
              style={{ width: noDataB ? '0%' : `${barB}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SustainabilityGauge({ score, label, color }: { score: number; label: string; color: 'blue' | 'violet' }) {
  const clampedScore = Math.min(100, Math.max(0, score));
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  const colorMap = {
    blue: { stroke: '#3b82f6', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950' },
    violet: { stroke: '#7c3aed', text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950' },
  };
  const c = colorMap[color];

  const grade =
    clampedScore >= 80
      ? 'Ausgezeichnet'
      : clampedScore >= 60
      ? 'Gut'
      : clampedScore >= 40
      ? 'Befriedigend'
      : 'Verbesserungsbedarf';

  return (
    <div className={cn('flex flex-col items-center gap-2 rounded-xl border p-5', c.bg)}>
      <p className={cn('text-[10px] font-bold uppercase tracking-widest', c.text)}>{label}</p>
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke={c.stroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black leading-none">{clampedScore.toFixed(0)}</span>
          <span className="text-[10px] text-muted-foreground font-medium">/ 100</span>
        </div>
      </div>
      <Badge
        variant="secondary"
        className={cn('text-[10px] font-semibold', c.text)}
      >
        {grade}
      </Badge>
    </div>
  );
}

function MaterialBar({ name, value, color }: { name: string; value: number; color: 'blue' | 'violet' }) {
  const colorClass = color === 'blue' ? 'bg-blue-500' : 'bg-violet-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate max-w-[70%] font-medium">{name}</span>
        <span className="text-muted-foreground font-semibold">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', colorClass)}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function ProjectComparison({
  projects,
  projectA,
  projectB,
  onSelectProjectA,
  onSelectProjectB,
  activeProjectId,
  activeModelAnalysis,
}: ProjectComparisonProps) {
  // Fallback: DIN 276 Kosten aus lokalem State, falls noch nicht in DB persistiert
  const din276Fallback = activeProjectId && activeModelAnalysis?.din276?.totalCost
    ? { projectId: activeProjectId, totalCost: activeModelAnalysis.din276.totalCost }
    : null;

  const comparisonData = useMemo(() => {
    const metricsA = calculateMetrics(projectA, projects, din276Fallback);
    const metricsB = calculateMetrics(projectB, projects, din276Fallback);
    const differences = calculateDifferences(metricsA, metricsB);
    return { projectA: metricsA, projectB: metricsB, differences };
  }, [projectA, projectB, projects, din276Fallback]);

  const chartData = useMemo(() => {
    if (!comparisonData.projectA || !comparisonData.projectB) return [];
    return [
      {
        metric: 'Kosten (T€)',
        A: +(comparisonData.projectA.totalCost / 1000).toFixed(1),
        B: +(comparisonData.projectB.totalCost / 1000).toFixed(1),
      },
      {
        metric: 'CO₂ (kg/m²)',
        A: +comparisonData.projectA.co2Emissions.toFixed(1),
        B: +comparisonData.projectB.co2Emissions.toFixed(1),
      },
      {
        metric: 'Recycling (%)',
        A: +comparisonData.projectA.recyclingRate.toFixed(1),
        B: +comparisonData.projectB.recyclingRate.toFixed(1),
      },
      {
        metric: 'Nachhaltigkeit (%)',
        A: +comparisonData.projectA.sustainabilityScore.toFixed(1),
        B: +comparisonData.projectB.sustainabilityScore.toFixed(1),
      },
    ];
  }, [comparisonData]);

  const radarData = useMemo(() => {
    if (!comparisonData.projectA || !comparisonData.projectB) return [];
    // Normalize all metrics to 0–100 scale for radar
    const maxCost = Math.max(comparisonData.projectA.totalCost, comparisonData.projectB.totalCost, 1);
    const maxCO2 = Math.max(comparisonData.projectA.co2Emissions, comparisonData.projectB.co2Emissions, 1);

    return [
      {
        subject: 'Nachhaltigkeit',
        A: +comparisonData.projectA.sustainabilityScore.toFixed(1),
        B: +comparisonData.projectB.sustainabilityScore.toFixed(1),
      },
      {
        subject: 'Recycling',
        A: +comparisonData.projectA.recyclingRate.toFixed(1),
        B: +comparisonData.projectB.recyclingRate.toFixed(1),
      },
      {
        subject: 'Kosteneff.',
        A: +(100 - (comparisonData.projectA.totalCost / maxCost) * 100).toFixed(1),
        B: +(100 - (comparisonData.projectB.totalCost / maxCost) * 100).toFixed(1),
      },
      {
        subject: 'CO₂-Eff.',
        A: +(100 - (comparisonData.projectA.co2Emissions / maxCO2) * 100).toFixed(1),
        B: +(100 - (comparisonData.projectB.co2Emissions / maxCO2) * 100).toFixed(1),
      },
    ];
  }, [comparisonData]);

  const chartConfig: ChartConfig = {
    A: { label: projectA?.fileName ?? 'Projekt A', color: 'hsl(217 91% 60%)' },
    B: { label: projectB?.fileName ?? 'Projekt B', color: 'hsl(263 70% 50%)' },
  };

  // ── Empty state ─────────────────────────────────────────────────────────
  if (!projectA || !projectB) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 space-y-5">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
          <ArrowLeftRight className="w-9 h-9 text-muted-foreground/50" />
        </div>
        <div>
          <h3 className="font-semibold text-xl mb-1">Projektvergleich</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Wählen Sie zwei Projekte aus den Dropdowns aus, um eine detaillierte Gegenüberstellung zu sehen.
          </p>
        </div>
      </div>
    );
  }

  if (!projectA.analysisData || !projectB.analysisData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 space-y-5">
        <div className="w-20 h-20 rounded-2xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
          <AlertCircle className="w-9 h-9 text-amber-500" />
        </div>
        <div>
          <h3 className="font-semibold text-xl mb-1">Unvollständige Daten</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Beide Projekte benötigen Analysedaten für einen Vergleich. Führen Sie zuerst eine Analyse durch.
          </p>
        </div>
      </div>
    );
  }

  const { differences } = comparisonData;

  return (
    <div className="space-y-6">

      {/* ── 1. Projektauswahl ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
        {/* Project A Selector */}
        <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Projekt A</span>
          </div>
          <Select
            value={projectA.id}
            onValueChange={(value) => {
              const selected = projects.find((p) => p.id === value);
              onSelectProjectA(selected || null);
            }}
          >
            <SelectTrigger className="border-blue-200 dark:border-blue-800 bg-white dark:bg-blue-950/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects
                .filter((p) => p.analysisData)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fileName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground truncate" title={projectA.fileName}>
            {projectA.fileName}
          </p>
        </div>

        {/* VS Divider */}
        <div className="flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-muted border flex items-center justify-center">
            <span className="text-xs font-black text-muted-foreground">VS</span>
          </div>
        </div>

        {/* Project B Selector */}
        <div className="rounded-xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">Projekt B</span>
          </div>
          <Select
            value={projectB.id}
            onValueChange={(value) => {
              const selected = projects.find((p) => p.id === value);
              onSelectProjectB(selected || null);
            }}
          >
            <SelectTrigger className="border-violet-200 dark:border-violet-800 bg-white dark:bg-violet-950/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects
                .filter((p) => p.analysisData && p.id !== projectA.id)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fileName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground truncate" title={projectB.fileName}>
            {projectB.fileName}
          </p>
        </div>
      </div>

      {/* ── 2. Kennzahlen ─────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Kennzahlen im Vergleich
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MetricRow
            label="Gesamtkosten"
            icon={<Euro className="w-4 h-4" />}
            valueA={comparisonData.projectA?.totalCost ?? 0}
            valueB={comparisonData.projectB?.totalCost ?? 0}
            unit="€"
            metricKey="totalCost"
            difference={
              comparisonData.projectA?.totalCost && comparisonData.projectB?.totalCost
                ? differences?.totalCost ?? null
                : null
            }
            formatValue={(v) => v.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
            noDataA={!projectA.costEstimationData?.totalEstimatedCost}
            noDataB={!projectB.costEstimationData?.totalEstimatedCost}
          />
          <MetricRow
            label="CO₂-Emissionen"
            icon={<Leaf className="w-4 h-4" />}
            valueA={comparisonData.projectA?.co2Emissions ?? 0}
            valueB={comparisonData.projectB?.co2Emissions ?? 0}
            unit="kg CO₂/m²"
            metricKey="co2Emissions"
            difference={differences?.co2Emissions ?? null}
          />
          <MetricRow
            label="Recyclinganteil"
            icon={<Recycle className="w-4 h-4" />}
            valueA={comparisonData.projectA?.recyclingRate ?? 0}
            valueB={comparisonData.projectB?.recyclingRate ?? 0}
            unit="%"
            metricKey="recyclingRate"
            difference={differences?.recyclingRate ?? null}
          />
          <MetricRow
            label="Materialvolumen gesamt"
            icon={<Layers className="w-4 h-4" />}
            valueA={comparisonData.projectA?.totalElements ?? 0}
            valueB={comparisonData.projectB?.totalElements ?? 0}
            unit="%"
            metricKey="totalElements"
            difference={differences?.totalElements ?? null}
          />
        </div>
      </div>

      {/* ── 3. Visualisierung ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-headline">Metriken im Überblick</CardTitle>
            <CardDescription>Normalisierter Vergleich aller Kennzahlen</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis
                  dataKey="metric"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--accent) / 0.15)' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => [
                    value.toLocaleString('de-DE'),
                    name === 'A' ? (projectA?.fileName ?? 'Projekt A') : (projectB?.fileName ?? 'Projekt B'),
                  ]}
                />
                <Legend
                  formatter={(value) =>
                    value === 'A' ? (projectA?.fileName ?? 'Projekt A') : (projectB?.fileName ?? 'Projekt B')
                  }
                  wrapperStyle={{ fontSize: '11px' }}
                />
                <Bar dataKey="A" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} name="A" />
                <Bar dataKey="B" fill="hsl(263 70% 50%)" radius={[4, 4, 0, 0]} name="B" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Radar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-headline">Stärken-Profil</CardTitle>
            <CardDescription>Effizienz-Radar (höher = besser)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
                <Radar
                  name={projectA?.fileName ?? 'Projekt A'}
                  dataKey="A"
                  stroke="hsl(217 91% 60%)"
                  fill="hsl(217 91% 60%)"
                  fillOpacity={0.25}
                />
                <Radar
                  name={projectB?.fileName ?? 'Projekt B'}
                  dataKey="B"
                  stroke="hsl(263 70% 50%)"
                  fill="hsl(263 70% 50%)"
                  fillOpacity={0.25}
                />
                <Legend
                  formatter={(value) =>
                    value === (projectA?.fileName ?? 'Projekt A')
                      ? (projectA?.fileName ?? 'Projekt A')
                      : (projectB?.fileName ?? 'Projekt B')
                  }
                  wrapperStyle={{ fontSize: '11px' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── 4. Materialzusammensetzung ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-headline">Materialzusammensetzung</CardTitle>
          <CardDescription>Anteil der Materialien an der Gesamtkomposition</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                  Projekt A
                </span>
              </div>
              {projectA.analysisData.materialComposition.map((mat, idx) => (
                <MaterialBar key={idx} name={mat.name} value={mat.value} color="blue" />
              ))}
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                  Projekt B
                </span>
              </div>
              {projectB.analysisData.materialComposition.map((mat, idx) => (
                <MaterialBar key={idx} name={mat.name} value={mat.value} color="violet" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 5. Nachhaltigkeitsbewertung ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-headline flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Nachhaltigkeitsbewertung
          </CardTitle>
          <CardDescription>
            Kombinierter Score aus CO₂-Emissionen (50%), Recyclinganteil (30%) und Kosten (20%)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Gauges */}
          <div className="grid grid-cols-2 gap-4">
            <SustainabilityGauge
              score={comparisonData.projectA?.sustainabilityScore ?? 0}
              label="Projekt A"
              color="blue"
            />
            <SustainabilityGauge
              score={comparisonData.projectB?.sustainabilityScore ?? 0}
              label="Projekt B"
              color="violet"
            />
          </div>

          {/* Winner Banner */}
          {differences && differences.sustainabilityScore.absolute !== 0 && (
            <div
              className={cn(
                'flex items-center gap-3 rounded-xl p-4 border',
                differences.sustainabilityScore.absolute > 0
                  ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800'
                  : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
              )}
            >
              <Award
                className={cn(
                  'w-8 h-8 flex-shrink-0',
                  differences.sustainabilityScore.absolute > 0
                    ? 'text-violet-500'
                    : 'text-blue-500'
                )}
              />
              <div>
                <p className="font-semibold text-sm">
                  {differences.sustainabilityScore.absolute > 0 ? 'Projekt B' : 'Projekt A'} ist nachhaltiger
                </p>
                <p className="text-xs text-muted-foreground">
                  Vorsprung:{' '}
                  <span className="font-semibold">
                    {Math.abs(differences.sustainabilityScore.absolute).toFixed(1)} Punkte (
                    {Math.abs(differences.sustainabilityScore.percentage).toFixed(1)}%)
                  </span>
                </p>
              </div>
              <DeltaBadge
                value={differences.sustainabilityScore.absolute}
                percentage={differences.sustainabilityScore.percentage}
                metricKey="sustainabilityScore"
                unit=""
              />
            </div>
          )}

          {differences && differences.sustainabilityScore.absolute === 0 && (
            <div className="flex items-center gap-3 rounded-xl p-4 border bg-muted/40">
              <ArrowRight className="w-6 h-6 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Beide Projekte haben den gleichen Nachhaltigkeitswert.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
