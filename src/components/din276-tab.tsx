'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Layers, Info } from 'lucide-react';
import type { Din276QuantityResult, Din276CostGroupResult } from '@/utils/din276Mapper';

interface Din276TabProps {
    result: Din276QuantityResult | null;
}

function fmt(v: number | undefined, unit: string): string {
    if (v === undefined || v === null || v === 0) return '—';
    return `${v.toFixed(2)} ${unit}`;
}

const KG_COLORS: Record<string, string> = {
    '320': 'bg-stone-100 text-stone-700 border-stone-300',
    '330': 'bg-blue-100 text-blue-700 border-blue-300',
    '334': 'bg-sky-100 text-sky-700 border-sky-300',
    '340': 'bg-amber-100 text-amber-700 border-amber-300',
    '344': 'bg-orange-100 text-orange-700 border-orange-300',
    '350': 'bg-purple-100 text-purple-700 border-purple-300',
    '360': 'bg-rose-100 text-rose-700 border-rose-300',
    '370': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    '380': 'bg-teal-100 text-teal-700 border-teal-300',
    '390': 'bg-lime-100 text-lime-700 border-lime-300',
};

function kgColor(kg: string): string {
    return KG_COLORS[kg] ?? 'bg-muted text-muted-foreground border-border';
}

export function Din276Tab({ result }: Din276TabProps) {
    if (!result) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Layers className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg">DIN 276 Mengenauswertung</h3>
                <p className="text-muted-foreground text-sm mt-1">
                    Starten Sie die Modellprüfung, um die DIN 276 Auswertung hier anzuzeigen.
                </p>
            </div>
        );
    }

    if (result.groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Info className="w-12 h-12 text-yellow-500/70 mb-4" />
                <h3 className="font-semibold text-lg">Keine zuordenbaren Bauteile</h3>
                <p className="text-muted-foreground text-sm mt-1 max-w-md">
                    Das IFC-Modell enthält keine Bauteile, die automatisch einer DIN 276 Kostengruppe
                    zugeordnet werden konnten.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Kostenübersicht */}
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-primary">
                        Geschätzte Baukosten (KG 300)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl font-bold text-primary">
                        {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(result.totalCost)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Basierend auf statistischen BKI-Mittelwerten
                    </p>
                </CardContent>
            </Card>

            {/* Zusammenfassung */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">
                        Mengenübersicht nach DIN 276
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                Gesamtfläche
                            </p>
                            <p className="text-lg font-bold">{fmt(result.totalArea, 'm²')}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                Gesamtvolumen
                            </p>
                            <p className="text-lg font-bold">{fmt(result.totalVolume, 'm³')}</p>
                        </div>
                        <div className="rounded-lg border p-3 col-span-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                Kostengruppen
                            </p>
                            <p className="text-lg font-bold">{result.groups.length}</p>
                            <p className="text-xs text-muted-foreground">
                                {result.groups.reduce((s, g) => s + g.elementCount, 0)} Bauteile zugeordnet
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Detail je KG */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">
                        Kostengruppen-Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 pb-2">
                    <Accordion type="multiple" className="w-full">
                        {result.groups.map((group) => (
                            <CostGroupItem key={group.kg} group={group} />
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        </div>
    );
}

function CostGroupItem({ group }: { group: Din276CostGroupResult }) {
    return (
        <AccordionItem value={group.kg} className="border-b last:border-b-0">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                <div className="flex items-center gap-3 text-left w-full mr-4">
                    <Badge variant="outline" className={`${kgColor(group.kg)} text-xs font-mono shrink-0`}>
                        KG {group.kg}
                    </Badge>
                    <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{group.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                            ({group.elementCount} {group.elementCount === 1 ? 'Bauteil' : 'Bauteile'})
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs tabular-nums shrink-0">
                        <div className="text-muted-foreground text-right hidden sm:block w-20">
                            {group.unitPrice > 0 ? `${group.unitPrice} €/${group.unit}` : '—'}
                        </div>
                        <div className="font-medium text-right w-24 text-primary">
                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(group.totalCost)}
                        </div>
                        <div className="text-muted-foreground text-right w-24">
                            {group.totalArea > 0 && <span>{fmt(group.totalArea, 'm²')}</span>}
                            {group.totalArea === 0 && group.totalVolume > 0 && <span>{fmt(group.totalVolume, 'm³')}</span>}
                        </div>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px]">ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Typ</TableHead>
                                <TableHead>Material</TableHead>
                                <TableHead className="text-right">Fläche</TableHead>
                                <TableHead className="text-right">Volumen</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {group.elements.map((el) => (
                                <TableRow key={el.id}>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        {el.id}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium truncate max-w-[200px]">
                                        {el.name ?? '—'}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {el.type.replace(/^Ifc/i, '').replace(/^IFC/i, '')}
                                    </TableCell>
                                    <TableCell className="text-xs truncate max-w-[150px]">
                                        {el.material ?? '—'}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-sm">
                                        {fmt(el.quantities?.area, 'm²')}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-sm">
                                        {fmt(el.quantities?.volume, 'm³')}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}
