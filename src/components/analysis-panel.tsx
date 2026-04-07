
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, TrendingDown, TrendingUp, ArrowRight, BarChart3, Loader2, Euro, Leaf } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { ChartConfig, ChartContainer } from '@/components/ui/chart';
import type { IFCModel } from '@/lib/types';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tr, type Language } from '@/lib/i18n';

interface AnalysisPanelProps {
  language: Language;
  project: IFCModel | null;
  isProcessing: boolean;
  onRunAnalysis: () => void;
  onRunCostEstimation: (totalArea: number) => void;
  onExport: () => void;
  onDownloadExchangedIfc?: () => void;
}

const RatingIcon = ({ rating }: { rating: string }) => {
  switch (rating) {
    case 'high':
      return <TrendingUp className="w-5 h-5 text-destructive" />;
    case 'medium':
      return <ArrowRight className="w-5 h-5 text-yellow-500" />;
    case 'low':
      return <TrendingDown className="w-5 h-5 text-green-500" />;
    default:
      return null;
  }
};

function translateIndicatorName(language: Language, name: string): string {
  if (language === 'de') return name;
  const map: Record<string, string> = {
    'Erderwärmungspotenzial (GWP)': 'Global warming potential (GWP)',
    'Primärenergie nicht erneuerbar (PENRT)': 'Non-renewable primary energy (PENRT)',
    'GWP Gesamt': 'Total GWP',
  };
  return map[name] ?? name;
}

export function AnalysisPanel({ language, project, isProcessing, onRunAnalysis, onRunCostEstimation, onExport, onDownloadExchangedIfc }: AnalysisPanelProps) {

  if (isProcessing && !project?.analysisData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="font-semibold">{tr(language, 'Analyse wird durchgeführt...', 'Analysis is running...')}</p>
        <p className="text-muted-foreground text-sm">{tr(language, 'Dies kann einen Moment dauern.', 'This may take a moment.')}</p>
      </div>
    );
  }

  if (!project?.analysisData || !project.analysisData.materialComposition || project.analysisData.materialComposition.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <BarChart3 className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-semibold text-lg">{tr(language, 'Analyse bereit', 'Analysis ready')}</h3>
        <p className="text-muted-foreground text-sm mb-4">{tr(language, 'Starten Sie die KI-Analyse für dieses Modell.', 'Start the AI analysis for this model.')}</p>
        <Button onClick={onRunAnalysis} disabled={isProcessing}>
          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Leaf className="mr-2 h-4 w-4" />}
          {tr(language, 'Nachhaltigkeitsanalyse starten', 'Start sustainability analysis')}
        </Button>
      </div>
    );
  }

  const { analysisData } = project;

  const chartConfig = analysisData.materialComposition.reduce((acc, cur) => {
    acc[cur.name] = { label: cur.name, color: cur.fill };
    return acc;
  }, {} as ChartConfig);

  return (
    <div className="w-full mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-lg">{tr(language, 'Zusammenfassung', 'Summary')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysisData.summary}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-1">
        {analysisData.indicators.map((indicator, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{translateIndicatorName(language, indicator.name)}</CardTitle>
              <RatingIcon rating={indicator.rating} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{indicator.value}</div>
              <p className="text-xs text-muted-foreground">{indicator.unit} ({indicator.a})</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-lg">{tr(language, 'Materialzusammensetzung (Massen-%)', 'Material composition (mass %)')}</CardTitle>
        </CardHeader>
        <CardContent className="pl-0">
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={analysisData.materialComposition} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--foreground))' }} width={80} interval={0} className="text-xs" />
              <Tooltip cursor={{ fill: 'hsl(var(--accent) / 0.2)' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="value" radius={4}>
                {analysisData.materialComposition.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Button onClick={onExport} className="w-full">
        <FileText className="mr-2 h-4 w-4" />
        {tr(language, 'Materialpass exportieren', 'Export material passport')}
      </Button>

      {onDownloadExchangedIfc && (
        <Button onClick={onDownloadExchangedIfc} variant="outline" className="w-full mt-2">
          <TrendingUp className="mr-2 h-4 w-4 transform rotate-45" />
          {tr(language, 'Aktualisierte IFC herunterladen', 'Download updated IFC')}
        </Button>
      )}
    </div>
  );
}
