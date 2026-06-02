'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from 'recharts';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import type { EnergyPassData, EnergyEfficiencyClass } from '@/lib/types';
import { tr, type Language } from '@/lib/i18n';
import { EnergyPassPdfPreview } from '@/components/energy-pass-pdf-preview';


interface EnergyPassTabProps {
  language: Language;
  data: EnergyPassData;
}

/* ----------------------------------------------------------------
   Efficiency class styling & config
   ---------------------------------------------------------------- */

const EFFICIENCY_CLASSES: { label: EnergyEfficiencyClass; color: string; maxKwh: number }[] = [
  { label: 'A+', color: '#00845a', maxKwh: 30 },
  { label: 'A',  color: '#3fa535', maxKwh: 50 },
  { label: 'B',  color: '#8cc63f', maxKwh: 75 },
  { label: 'C',  color: '#d4e157', maxKwh: 100 },
  { label: 'D',  color: '#fdd835', maxKwh: 130 },
  { label: 'E',  color: '#ffb300', maxKwh: 160 },
  { label: 'F',  color: '#fb8c00', maxKwh: 200 },
  { label: 'G',  color: '#f4511e', maxKwh: 250 },
  { label: 'H',  color: '#c62828', maxKwh: 999 },
];

function getClassColor(cls: EnergyEfficiencyClass): string {
  return EFFICIENCY_CLASSES.find(c => c.label === cls)?.color || '#888';
}

/* ----------------------------------------------------------------
   Sub-components
   ---------------------------------------------------------------- */

function EfficiencyScale({ activeClass, language }: { activeClass: EnergyEfficiencyClass; language: Language }) {
  const activeIdx = EFFICIENCY_CLASSES.findIndex(c => c.label === activeClass);

  return (
    <div className="w-full">
      <p className="text-xs text-muted-foreground mb-2 font-medium">
        {tr(language, 'Energieeffizienzklasse', 'Energy efficiency class')}
      </p>
      <div className="relative flex flex-col gap-0.5">
        {EFFICIENCY_CLASSES.map((cls, idx) => {
          const isActive = idx === activeIdx;
          // Arrow widths grow per row
          const widthPercent = 30 + idx * 8.5;

          return (
            <div key={cls.label} className="flex items-center gap-2 group">
              {/* Arrow-shaped bar */}
              <div
                className="relative flex items-center transition-all duration-500 ease-out"
                style={{
                  width: `${widthPercent}%`,
                  minHeight: isActive ? 36 : 28,
                }}
              >
                <div
                  className="absolute inset-0 transition-all duration-500"
                  style={{
                    background: cls.color,
                    clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)',
                    opacity: isActive ? 1 : 0.55,
                    filter: isActive ? 'brightness(1.1) drop-shadow(0 0 8px rgba(0,0,0,0.2))' : 'none',
                  }}
                />
                <span
                  className="relative z-10 text-white font-bold text-xs pl-3 transition-all duration-300"
                  style={{
                    fontSize: isActive ? '0.85rem' : '0.7rem',
                  }}
                >
                  {cls.label}
                </span>
              </div>

              {/* Active indicator */}
              {isActive && (
                <div
                  className="flex items-center gap-1.5 animate-in slide-in-from-left-2 duration-500"
                >
                  <div
                    className="w-0 h-0"
                    style={{
                      borderTop: '8px solid transparent',
                      borderBottom: '8px solid transparent',
                      borderRight: `10px solid ${cls.color}`,
                    }}
                  />
                  <span
                    className="text-sm font-bold px-2 py-0.5 rounded-md"
                    style={{
                      color: cls.color,
                      background: `${cls.color}18`,
                    }}
                  >
                    {tr(language, 'Ihr Gebäude', 'Your building')}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 tracking-wide">
        {tr(language, 'Skala nach GEG / EnEV in kWh/(m²·a)', 'Scale per GEG / EnEV in kWh/(m²·a)')}
      </p>
    </div>
  );
}

function MetricCard({
  title,
  total,
  perArea,
  accentColor,
}: {
  title: string;
  total: number;
  perArea: number;
  accentColor: string;
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-card to-card/80">
      <div className="h-1" style={{ background: accentColor }} />
      <CardContent className="pt-4 pb-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{title}</p>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-extrabold tabular-nums" style={{ color: accentColor }}>
            {perArea.toLocaleString('de-DE', { maximumFractionDigits: 1 })}
          </span>
          <span className="text-sm text-muted-foreground pb-1">kWh/(m²·a)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {tr(
            'de' as any,
            `Gesamt: ${total.toLocaleString('de-DE', { maximumFractionDigits: 0 })} kWh/a`,
            `Total: ${total.toLocaleString('en-US', { maximumFractionDigits: 0 })} kWh/a`
          )}
        </p>
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------
   Main component
   ---------------------------------------------------------------- */

export function EnergyPassTab({ language, data }: EnergyPassTabProps) {
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const activeColor = getClassColor(data.efficiencyClass);


  // Sort end uses by value descending for the chart
  const sortedEndUses = useMemo(() =>
    [...data.endUses].sort((a, b) => b.value - a.value),
    [data.endUses]
  );

  // Generate colors for end-use chart bars
  const endUseColors = [
    'hsl(220, 70%, 55%)',
    'hsl(190, 70%, 50%)',
    'hsl(160, 60%, 45%)',
    'hsl(35, 90%, 55%)',
    'hsl(10, 75%, 55%)',
    'hsl(280, 55%, 55%)',
    'hsl(50, 80%, 50%)',
    'hsl(330, 60%, 55%)',
  ];

  const chartConfig: ChartConfig = sortedEndUses.reduce((acc, eu, idx) => {
    acc[eu.category] = { label: eu.category, color: endUseColors[idx % endUseColors.length] };
    return acc;
  }, {} as ChartConfig);

  return (
    <div className="w-full space-y-6 animate-in fade-in-0 duration-700">
      {/* Header badge with PDF Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/40 p-4 rounded-2xl border border-border/50">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-14 h-14 rounded-2xl text-white font-black text-xl shadow-lg shrink-0"
            style={{
              background: `linear-gradient(135deg, ${activeColor}, ${activeColor}cc)`,
              boxShadow: `0 4px 20px ${activeColor}40`,
            }}
          >
            {data.efficiencyClass}
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">
              {data.buildingInfo.name}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data.buildingInfo.area.toLocaleString('de-DE', { maximumFractionDigits: 0 })} m²
              {data.buildingInfo.environment ? ` · ${data.buildingInfo.environment}` : ''}
            </p>
          </div>
        </div>

        <Button
          onClick={() => setIsPdfPreviewOpen(true)}
          className="flex items-center gap-2 font-bold px-4 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-red-600/25 transition-all duration-300 shrink-0 self-start sm:self-center"
        >
          <FileText className="w-4 h-4 animate-pulse" />
          {tr(language, 'PDF exportieren', 'Export PDF')}
        </Button>
      </div>


      {/* Efficiency scale */}
      <Card className="overflow-hidden">
        <CardContent className="pt-5 pb-5">
          <EfficiencyScale activeClass={data.efficiencyClass} language={language} />
        </CardContent>
      </Card>

      {/* KPI metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          title={tr(language, 'Endenergiebedarf', 'Final energy demand')}
          total={data.siteEnergy.total}
          perArea={data.siteEnergy.perArea}
          accentColor="hsl(210, 70%, 50%)"
        />
        <MetricCard
          title={tr(language, 'Primärenergiebedarf', 'Primary energy demand')}
          total={data.sourceEnergy.total}
          perArea={data.sourceEnergy.perArea}
          accentColor={activeColor}
        />
      </div>

      {/* End uses chart */}
      {sortedEndUses.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-headline text-lg">
              {tr(language, 'Energieverbrauch nach Kategorie', 'Energy consumption by category')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-0 pr-2">
            <ChartContainer
              config={chartConfig}
              className="w-full"
              style={{ height: Math.max(200, sortedEndUses.length * 48 + 40) }}
            >
              <BarChart
                data={sortedEndUses}
                layout="vertical"
                margin={{ left: 10, right: 40, top: 5, bottom: 5 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `${v.toLocaleString('de-DE')} kWh`}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
                <YAxis
                  dataKey="category"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                  width={160}
                  interval={0}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--accent) / 0.15)' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value: number) => [`${value.toLocaleString('de-DE')} kWh`, '']}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                  {sortedEndUses.map((_, idx) => (
                    <Cell key={idx} fill={endUseColors[idx % endUseColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <EnergyPassPdfPreview
        isOpen={isPdfPreviewOpen}
        onOpenChange={setIsPdfPreviewOpen}
        language={language}
        data={data}
      />
    </div>
  );
}


