'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, Cell } from 'recharts';
import { ChartContainer, ChartConfig } from '@/components/ui/chart';
import { TrendingUp, TrendingDown, ArrowRight, Euro, Leaf, Package, Co2 } from 'lucide-react';
import type { IFCModel } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

interface ProjectComparisonProps {
  projects: IFCModel[];
  projectA: IFCModel | null;
  projectB: IFCModel | null;
  onSelectProjectA: (project: IFCModel | null) => void;
  onSelectProjectB: (project: IFCModel | null) => void;
}

interface ComparisonMetrics {
  totalCost: number;
  co2Emissions: number;
  recyclingRate: number;
  totalElements: number;
  sustainabilityScore: number;
}

interface ComparisonData {
  projectA: ComparisonMetrics | null;
  projectB: ComparisonMetrics | null;
  differences: {
    totalCost: { absolute: number; percentage: number };
    co2Emissions: { absolute: number; percentage: number };
    recyclingRate: { absolute: number; percentage: number };
    totalElements: { absolute: number; percentage: number };
    sustainabilityScore: { absolute: number; percentage: number };
  };
}

// Extrahiere Zahlenwerte aus formatierten Strings
const extractNumber = (value: string): number => {
  if (!value) return 0;
  // Entferne alle nicht-numerischen Zeichen außer Punkt und Komma
  const cleaned = value.replace(/[^\d.,]/g, '').replace(/,/g, '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// Normalisiere einen Wert zwischen 0 und 1 basierend auf Min/Max
const normalize = (value: number, min: number, max: number): number => {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
};

// Berechne Metriken aus einem Projekt
const calculateMetrics = (project: IFCModel | null, allProjects: IFCModel[]): ComparisonMetrics | null => {
  if (!project || !project.analysisData) return null;

  // Gesamtkosten extrahieren
  let totalCost = 0;
  if (project.costEstimationData?.totalEstimatedCost) {
    totalCost = extractNumber(project.costEstimationData.totalEstimatedCost);
  }

  // CO₂-Emissionen finden
  let co2Emissions = 0;
  const gwpIndicator = project.analysisData.indicators.find(
    (ind) => ind.name.toLowerCase().includes('erderwärmung') || ind.name.toLowerCase().includes('gwp')
  );
  if (gwpIndicator) {
    co2Emissions = extractNumber(gwpIndicator.value);
  }

  // Recyclinganteil finden
  let recyclingRate = 0;
  const recyclingIndicator = project.analysisData.indicators.find(
    (ind) => ind.name.toLowerCase().includes('recycelt') || ind.name.toLowerCase().includes('recycling')
  );
  if (recyclingIndicator) {
    recyclingRate = extractNumber(recyclingIndicator.value);
  }

  // Gesamtanzahl Elemente (als Summe der Materialanteile approximiert)
  // In der Realität könnte dies aus IFC-Daten kommen
  const totalElements = project.analysisData.materialComposition.reduce((sum, mat) => sum + mat.value, 0);

  // Berechne Normalisierungs-Werte für alle Projekte
  const allCosts = allProjects
    .map((p) => p.costEstimationData?.totalEstimatedCost ? extractNumber(p.costEstimationData.totalEstimatedCost) : 0)
    .filter((c) => c > 0);
  const allCO2 = allProjects
    .map((p) => {
      const gwp = p.analysisData?.indicators?.find((ind) => ind.name.toLowerCase().includes('erderwärmung') || ind.name.toLowerCase().includes('gwp'));
      return gwp ? extractNumber(gwp.value) : 0;
    })
    .filter((c) => c > 0);

  const minCost = allCosts.length > 0 ? Math.min(...allCosts) : totalCost;
  const maxCost = allCosts.length > 0 ? Math.max(...allCosts) : totalCost || 1000000;
  const minCO2 = allCO2.length > 0 ? Math.min(...allCO2) : co2Emissions;
  const maxCO2 = allCO2.length > 0 ? Math.max(...allCO2) : co2Emissions || 1000;

  // Nachhaltigkeitswert berechnen
  const normalizedCO2 = normalize(co2Emissions, minCO2, maxCO2);
  const normalizedCost = normalize(totalCost, minCost, maxCost);
  const sustainabilityScore =
    0.5 * (1 - normalizedCO2) + 0.3 * (recyclingRate / 100) + 0.2 * (1 - normalizedCost);

  return {
    totalCost,
    co2Emissions,
    recyclingRate,
    totalElements,
    sustainabilityScore: sustainabilityScore * 100, // Als Prozentwert
  };
};

// Berechne Differenzen
const calculateDifferences = (
  metricsA: ComparisonMetrics | null,
  metricsB: ComparisonMetrics | null
): ComparisonData['differences'] | null => {
  if (!metricsA || !metricsB) return null;

  const calculateDiff = (a: number, b: number) => {
    const absolute = b - a;
    const percentage = a !== 0 ? (absolute / a) * 100 : (b !== 0 ? 100 : 0);
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

// Bestimme ob eine Änderung eine Verbesserung ist
const isImprovement = (metric: string, difference: number): boolean => {
  switch (metric) {
    case 'totalCost':
    case 'co2Emissions':
      return difference < 0; // Niedriger ist besser
    case 'recyclingRate':
    case 'sustainabilityScore':
      return difference > 0; // Höher ist besser
    case 'totalElements':
      return false; // Neutrale Metrik
    default:
      return false;
  }
};

const ComparisonMetricCard = ({
  title,
  valueA,
  valueB,
  unit,
  difference,
  metricKey,
}: {
  title: string;
  valueA: number | null;
  valueB: number | null;
  unit: string;
  difference: { absolute: number; percentage: number } | null;
  metricKey: string;
}) => {
  if (valueA === null || valueB === null || !difference) {
    return null;
  }

  const isImproved = isImprovement(metricKey, difference.absolute);
  const diffColor = isImproved ? 'text-green-600' : difference.absolute === 0 ? 'text-muted-foreground' : 'text-red-600';
  const diffIcon =
    difference.absolute === 0 ? null : isImproved ? (
      <TrendingDown className="w-4 h-4" />
    ) : (
      <TrendingUp className="w-4 h-4" />
    );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Projekt A</p>
            <p className="text-lg font-bold">{valueA.toLocaleString('de-DE')} {unit}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Projekt B</p>
            <p className="text-lg font-bold">{valueB.toLocaleString('de-DE')} {unit}</p>
          </div>
        </div>
        <div className={`pt-2 border-t flex items-center gap-2 ${diffColor}`}>
          {diffIcon}
          <span className="text-sm font-medium">
            {difference.absolute >= 0 ? '+' : ''}
            {difference.absolute.toFixed(2)} {unit} ({difference.percentage >= 0 ? '+' : ''}
            {difference.percentage.toFixed(1)}%)
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export function ProjectComparison({
  projects,
  projectA,
  projectB,
  onSelectProjectA,
  onSelectProjectB,
}: ProjectComparisonProps) {
  const comparisonData = useMemo(() => {
    const metricsA = calculateMetrics(projectA, projects);
    const metricsB = calculateMetrics(projectB, projects);
    const differences = calculateDifferences(metricsA, metricsB);

    return {
      projectA: metricsA,
      projectB: metricsB,
      differences,
    };
  }, [projectA, projectB, projects]);

  // Bereite Daten für Balkendiagramm vor
  const chartData = useMemo(() => {
    if (!comparisonData.projectA || !comparisonData.projectB) return [];

    const data = [
      {
        metric: 'Gesamtkosten',
        projectA: comparisonData.projectA.totalCost,
        projectB: comparisonData.projectB.totalCost,
        unit: '€',
      },
      {
        metric: 'CO₂-Emissionen',
        projectA: comparisonData.projectA.co2Emissions,
        projectB: comparisonData.projectB.co2Emissions,
        unit: 'kg CO₂-Äq/m²',
      },
      {
        metric: 'Recyclinganteil',
        projectA: comparisonData.projectA.recyclingRate,
        projectB: comparisonData.projectB.recyclingRate,
        unit: '%',
      },
      {
        metric: 'Nachhaltigkeitswert',
        projectA: comparisonData.projectA.sustainabilityScore,
        projectB: comparisonData.projectB.sustainabilityScore,
        unit: '%',
      },
    ];

    return data;
  }, [comparisonData]);

  const chartConfig: ChartConfig = {
    projectA: { label: 'Projekt A', color: 'hsl(var(--chart-1))' },
    projectB: { label: 'Projekt B', color: 'hsl(var(--chart-2))' },
  };

  if (!projectA || !projectB) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
        <Package className="w-12 h-12 text-muted-foreground/50" />
        <h3 className="font-semibold text-lg">Projektvergleich</h3>
        <p className="text-muted-foreground text-sm">
          Wählen Sie zwei Projekte aus, um sie zu vergleichen.
        </p>
      </div>
    );
  }

  if (!projectA.analysisData || !projectB.analysisData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
        <Package className="w-12 h-12 text-muted-foreground/50" />
        <h3 className="font-semibold text-lg">Unvollständige Daten</h3>
        <p className="text-muted-foreground text-sm">
          Beide Projekte benötigen Analysedaten für einen Vergleich. Führen Sie zuerst eine Analyse durch.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Projektauswahl */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Projektauswahl</CardTitle>
          <CardDescription>Wählen Sie zwei Projekte zum Vergleich aus</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Projekt A</label>
              <Select
                value={projectA.id}
                onValueChange={(value) => {
                  const selected = projects.find((p) => p.id === value);
                  onSelectProjectA(selected || null);
                }}
              >
                <SelectTrigger>
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
              {projectA && (
                <p className="text-xs text-muted-foreground truncate" title={projectA.fileName}>
                  {projectA.fileName}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Projekt B</label>
              <Select
                value={projectB.id}
                onValueChange={(value) => {
                  const selected = projects.find((p) => p.id === value);
                  onSelectProjectB(selected || null);
                }}
              >
                <SelectTrigger>
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
              {projectB && (
                <p className="text-xs text-muted-foreground truncate" title={projectB.fileName}>
                  {projectB.fileName}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Übersicht */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Übersicht</CardTitle>
          <CardDescription>Vergleich der Hauptkennzahlen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComparisonMetricCard
              title="Gesamtkosten"
              valueA={comparisonData.projectA?.totalCost || null}
              valueB={comparisonData.projectB?.totalCost || null}
              unit="€"
              difference={comparisonData.differences?.totalCost || null}
              metricKey="totalCost"
            />
            <ComparisonMetricCard
              title="CO₂-Emissionen"
              valueA={comparisonData.projectA?.co2Emissions || null}
              valueB={comparisonData.projectB?.co2Emissions || null}
              unit="kg CO₂-Äq/m²"
              difference={comparisonData.differences?.co2Emissions || null}
              metricKey="co2Emissions"
            />
            <ComparisonMetricCard
              title="Recyclinganteil"
              valueA={comparisonData.projectA?.recyclingRate || null}
              valueB={comparisonData.projectB?.recyclingRate || null}
              unit="%"
              difference={comparisonData.differences?.recyclingRate || null}
              metricKey="recyclingRate"
            />
            <ComparisonMetricCard
              title="Gesamtanzahl Elemente"
              valueA={comparisonData.projectA?.totalElements || null}
              valueB={comparisonData.projectB?.totalElements || null}
              unit=""
              difference={comparisonData.differences?.totalElements || null}
              metricKey="totalElements"
            />
          </div>
        </CardContent>
      </Card>

      {/* Kosten & CO₂ */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Kosten & CO₂</CardTitle>
          <CardDescription>Visueller Vergleich der Kosten und Emissionen</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer>
              <BarChart data={chartData.slice(0, 2)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="metric"
                  tick={{ fill: 'hsl(var(--foreground))' }}
                  className="text-xs"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: 'hsl(var(--foreground))' }} className="text-xs" />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--accent) / 0.2)' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                  }}
                  formatter={(value: number, name: string, entry: any) => {
                    const metric = entry?.payload?.metric || '';
                    const unit = chartData.find((d) => d.metric === metric)?.unit || '';
                    const projectName = name === 'projectA' ? 'Projekt A' : 'Projekt B';
                    return [`${value.toLocaleString('de-DE')} ${unit}`, projectName];
                  }}
                />
                <Legend />
                <Bar dataKey="projectA" fill="hsl(var(--chart-1))" name="Projekt A" />
                <Bar dataKey="projectB" fill="hsl(var(--chart-2))" name="Projekt B" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Materialien */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Materialien</CardTitle>
          <CardDescription>Vergleich der Materialzusammensetzung</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Projekt A</h4>
              <div className="space-y-1">
                {projectA.analysisData.materialComposition.map((mat, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>{mat.name}</span>
                    <Badge variant="outline">{mat.value}%</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Projekt B</h4>
              <div className="space-y-1">
                {projectB.analysisData.materialComposition.map((mat, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>{mat.name}</span>
                    <Badge variant="outline">{mat.value}%</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gesamtwert */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Gesamtwert - Nachhaltigkeitsbewertung</CardTitle>
          <CardDescription>
            Kombinierter Nachhaltigkeitswert basierend auf CO₂-Emissionen, Recyclinganteil und Kosten
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Projekt A</p>
              <p className="text-3xl font-bold">
                {comparisonData.projectA?.sustainabilityScore.toFixed(1) || 'N/A'}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Projekt B</p>
              <p className="text-3xl font-bold">
                {comparisonData.projectB?.sustainabilityScore.toFixed(1) || 'N/A'}%
              </p>
            </div>
          </div>
          {comparisonData.differences && (
            <div className="pt-4 border-t">
              <div
                className={`flex items-center gap-2 ${
                  comparisonData.differences.sustainabilityScore.absolute > 0
                    ? 'text-green-600'
                    : comparisonData.differences.sustainabilityScore.absolute < 0
                    ? 'text-red-600'
                    : 'text-muted-foreground'
                }`}
              >
                {comparisonData.differences.sustainabilityScore.absolute > 0 ? (
                  <TrendingUp className="w-5 h-5" />
                ) : comparisonData.differences.sustainabilityScore.absolute < 0 ? (
                  <TrendingDown className="w-5 h-5" />
                ) : (
                  <ArrowRight className="w-5 h-5" />
                )}
                <div>
                  <p className="font-medium">
                    Differenz:{' '}
                    {comparisonData.differences.sustainabilityScore.absolute >= 0 ? '+' : ''}
                    {comparisonData.differences.sustainabilityScore.absolute.toFixed(1)}% (
                    {comparisonData.differences.sustainabilityScore.percentage >= 0 ? '+' : ''}
                    {comparisonData.differences.sustainabilityScore.percentage.toFixed(1)}%)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {comparisonData.differences.sustainabilityScore.absolute > 0
                      ? 'Projekt B ist nachhaltiger'
                      : comparisonData.differences.sustainabilityScore.absolute < 0
                      ? 'Projekt A ist nachhaltiger'
                      : 'Beide Projekte haben den gleichen Nachhaltigkeitswert'}
                  </p>
                </div>
              </div>
            </div>
          )}
          <ChartContainer config={chartConfig} className="h-[200px] w-full mt-4">
            <ResponsiveContainer>
              <BarChart data={chartData.slice(3, 4)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="metric"
                  tick={{ fill: 'hsl(var(--foreground))' }}
                  className="text-xs"
                />
                <YAxis tick={{ fill: 'hsl(var(--foreground))' }} className="text-xs" />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--accent) / 0.2)' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                />
                <Legend />
                <Bar dataKey="projectA" fill="hsl(var(--chart-1))" name="Projekt A" />
                <Bar dataKey="projectB" fill="hsl(var(--chart-2))" name="Projekt B" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
