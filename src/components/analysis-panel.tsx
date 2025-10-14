'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, TrendingDown, TrendingUp, ArrowRight } from 'lucide-react';
import { analysisData } from '@/lib/mock-data';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { ChartConfig, ChartContainer } from '@/components/ui/chart';

interface AnalysisPanelProps {
  onExport: () => void;
}

const chartConfig = analysisData.materialComposition.reduce((acc, cur) => {
    acc[cur.name] = { label: cur.name, color: cur.fill };
    return acc;
}, {} as ChartConfig);


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

export function AnalysisPanel({ onExport }: AnalysisPanelProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-lg">Sustainability Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{analysisData.summary}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-1">
        {analysisData.indicators.map((indicator, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{indicator.name}</CardTitle>
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
          <CardTitle className="font-headline text-lg">Material Composition (by mass %)</CardTitle>
        </CardHeader>
        <CardContent className="pl-0">
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <ResponsiveContainer>
              <BarChart data={analysisData.materialComposition} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--foreground))' }} width={80} interval={0} className="text-xs"/>
                <Tooltip cursor={{ fill: 'hsl(var(--accent) / 0.2)' }} contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}/>
                <Bar dataKey="value" radius={4}>
                  {analysisData.materialComposition.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
      
      <Button onClick={onExport} className="w-full bg-primary hover:bg-primary/90">
        <FileText className="mr-2 h-4 w-4" />
        Export Material Passport
      </Button>
    </div>
  );
}
