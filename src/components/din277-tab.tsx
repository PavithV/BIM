'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { LayoutGrid, Info } from 'lucide-react';
import type { Din277Result, Din277Category } from '@/utils/modelChecker';
import { tr, type Language } from '@/lib/i18n';

interface Din277TabProps {
  language: Language;
  result: Din277Result | null;
}

function formatArea(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(2)} m²`;
}

function formatVolume(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(2)} m³`;
}

const categoryColors: Record<Din277Category, string> = {
  NUF: 'bg-blue-100 text-blue-700 border-blue-200',
  VF: 'bg-amber-100 text-amber-700 border-amber-200',
  TF: 'bg-purple-100 text-purple-700 border-purple-200',
};

const categoryLabels: Record<Din277Category, string> = {
  NUF: 'Nutzungsfläche',
  VF: 'Verkehrsfläche',
  TF: 'Technikfläche',
};

export function Din277Tab({ language, result }: Din277TabProps) {
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <LayoutGrid className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-semibold text-lg">{tr(language, 'DIN 277 Flächenauswertung', 'DIN 277 area evaluation')}</h3>
        <p className="text-muted-foreground text-sm mt-1">
          {tr(language, 'Starten Sie die Modellprüfung, um die DIN 277 Auswertung hier anzuzeigen.', 'Run the model check to display DIN 277 evaluation here.')}
        </p>
      </div>
    );
  }

  if (result.spaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Info className="w-12 h-12 text-yellow-500/70 mb-4" />
        <h3 className="font-semibold text-lg">{tr(language, 'Keine Raumdaten gefunden', 'No room data found')}</h3>
        <p className="text-muted-foreground text-sm mt-1 max-w-md">
          {tr(language, 'Das IFC-Modell enthält keine ', 'The IFC model contains no ')}
          <code className="text-xs bg-muted px-1 rounded">IfcSpace</code>
          {tr(language, ' Entitäten. Für eine DIN 277 Auswertung müssen Räume im Modell definiert sein.', ' entities. Spaces must be defined in the model for DIN 277 evaluation.')}
        </p>
      </div>
    );
  }

  const { summary, spaces } = result;

  return (
    <div className="space-y-4">
      {/* Zusammenfassung */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{tr(language, 'Flächenübersicht nach DIN 277', 'Area overview according to DIN 277')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">BGF</p>
              <p className="text-lg font-bold">{formatArea(summary.bgf)}</p>
              <p className="text-xs text-muted-foreground">{tr(language, 'Bruttogrundfläche', 'Gross floor area')}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">NRF</p>
              <p className="text-lg font-bold">{formatArea(summary.nrf)}</p>
              <p className="text-xs text-muted-foreground">{tr(language, 'Nettoraumfläche', 'Net room area')}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <p className="text-xs text-blue-600 uppercase tracking-wider">NUF</p>
              <p className="text-lg font-bold text-blue-700">{formatArea(summary.nuf)}</p>
              <p className="text-xs text-muted-foreground">{tr(language, 'Nutzungsfläche', 'Usable area')}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <p className="text-xs text-amber-600 uppercase tracking-wider">VF</p>
              <p className="text-lg font-bold text-amber-700">{formatArea(summary.vf)}</p>
              <p className="text-xs text-muted-foreground">{tr(language, 'Verkehrsfläche', 'Circulation area')}</p>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 col-span-2">
              <p className="text-xs text-purple-600 uppercase tracking-wider">TF</p>
              <p className="text-lg font-bold text-purple-700">{formatArea(summary.tf)}</p>
              <p className="text-xs text-muted-foreground">{tr(language, 'Technikfläche', 'Technical area')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailliste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {tr(language, `Raumdetails (${spaces.length} Räume)`, `Room details (${spaces.length} rooms)`)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">{tr(language, 'Name', 'Name')}</TableHead>
                <TableHead>{tr(language, 'Kategorie', 'Category')}</TableHead>
                <TableHead className="text-right">NGA</TableHead>
                <TableHead className="text-right">BGA</TableHead>
                <TableHead className="text-right">{tr(language, 'Volumen', 'Volume')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spaces.map((space) => (
                <TableRow key={space.expressID}>
                  <TableCell className="font-medium">
                    <div>
                      <span className="block truncate max-w-[180px]">
                        {space.name || space.longName || tr(language, `Raum #${space.expressID}`, `Room #${space.expressID}`)}
                      </span>
                      {space.longName && space.name && (
                        <span className="text-xs text-muted-foreground truncate block max-w-[180px]">
                          {space.longName}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={categoryColors[space.din277Category]}
                    >
                      {space.din277Category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatArea(space.netFloorArea)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatArea(space.grossFloorArea)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatVolume(space.volume)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">
                  {tr(language, 'Summe', 'Total')}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatArea(summary.nrf)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatArea(summary.bgf)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatVolume(
                    spaces.reduce((s, sp) => s + (sp.volume ?? 0), 0) || null
                  )}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Legende */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground px-1">
        {(Object.entries(categoryLabels) as [Din277Category, string][]).map(([cat, label]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <Badge variant="outline" className={`${categoryColors[cat]} text-[10px] px-1.5 py-0`}>
              {cat}
            </Badge>
            <span>{language === 'en' ? (cat === 'NUF' ? 'Usable area' : cat === 'VF' ? 'Circulation area' : 'Technical area') : label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
