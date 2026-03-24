'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCode2,
  CalendarDays,
  DoorOpen,
  Layers,
  Database,
} from 'lucide-react';
import type { ModelCheckResult } from '@/utils/modelChecker';
import { useState } from 'react';

interface ModelChecksTabProps {
  result: ModelCheckResult | null;
}

function StatusIcon({ status }: { status: 'ok' | 'warn' | 'error' }) {
  switch (status) {
    case 'ok':
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'warn':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-destructive" />;
  }
}

export function ModelChecksTab({ result }: ModelChecksTabProps) {
  const [expandedType, setExpandedType] = useState<string | null>(null);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Layers className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-semibold text-lg">Modellprüfung</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Starten Sie die Modellprüfung, um die Ergebnisse hier anzuzeigen.
        </p>
      </div>
    );
  }

  const totalElements = result.materialChecks.reduce((s, c) => s + c.total, 0);
  const totalWithout = result.materialChecks.reduce((s, c) => s + c.withoutMaterial, 0);

  return (
    <div className="space-y-4">
      {/* IFC Version & Metadaten */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <FileCode2 className="w-5 h-5 text-primary shrink-0" />
          <CardTitle className="text-sm font-medium">IFC-Version & Metadaten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">Schema:</span>
            <span className="font-medium">{result.ifcVersion ?? 'Unbekannt'}</span>

            <span className="text-muted-foreground">Projekt:</span>
            <span className="font-medium">{result.projectName ?? '—'}</span>
          </div>
          {result.creationDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <CalendarDays className="w-4 h-4" />
              <span>{result.creationDate}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Räume-Check */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <DoorOpen className="w-5 h-5 text-primary shrink-0" />
            <CardTitle className="text-sm font-medium">Räume (IfcSpace)</CardTitle>
          </div>
          <StatusIcon
            status={
              !result.spacesExist
                ? 'error'
                : result.unnamedSpaceCount > 0
                  ? 'warn'
                  : 'ok'
            }
          />
        </CardHeader>
        <CardContent>
          {result.spacesExist ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Räume gefunden:</span>
                <Badge variant="secondary">{result.spaceCount}</Badge>
              </div>
              {result.unnamedSpaceCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-yellow-600">Ohne Namen:</span>
                  <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                    {result.unnamedSpaceCount}
                  </Badge>
                </div>
              )}
              {result.unnamedSpaceCount === 0 && (
                <p className="text-xs text-green-600 mt-1">Alle Räume haben einen Namen ✓</p>
              )}
            </div>
          ) : (
            <div className="text-sm text-destructive">
              <p className="font-medium">Keine Räume (IfcSpace) im Modell vorhanden!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Für eine DIN 277 Auswertung werden IfcSpace-Entitäten benötigt.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Material-Check */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-primary shrink-0" />
            <CardTitle className="text-sm font-medium">Materialzuordnung</CardTitle>
          </div>
          <StatusIcon status={totalWithout === 0 ? 'ok' : totalWithout > totalElements * 0.3 ? 'error' : 'warn'} />
        </CardHeader>
        <CardContent className="space-y-3">
          {totalElements === 0 ? (
            <p className="text-sm text-muted-foreground">Keine prüfbaren Bauteile gefunden.</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Gesamt:</span>
                <span>
                  <span className="font-medium">{totalElements - totalWithout}</span>
                  <span className="text-muted-foreground"> / {totalElements} mit Material</span>
                </span>
              </div>

              {result.materialChecks.map((mc) => {
                const pct = mc.total > 0 ? Math.round((mc.withMaterial / mc.total) * 100) : 100;
                const isExpanded = expandedType === mc.elementType;
                return (
                  <div key={mc.elementType} className="space-y-1">
                    <button
                      className="flex items-center justify-between w-full text-left text-sm hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
                      onClick={() =>
                        setExpandedType(isExpanded ? null : mc.elementType)
                      }
                    >
                      <span className="font-medium">{mc.elementType}</span>
                      <span className="text-xs text-muted-foreground">
                        {mc.withMaterial}/{mc.total} ({pct}%)
                      </span>
                    </button>
                    <Progress value={pct} className="h-2" />
                    {isExpanded && mc.idsWithoutMaterial.length > 0 && (
                      <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 mt-1 max-h-24 overflow-y-auto">
                        <span className="font-medium text-yellow-600">
                          Ohne Material (Express-IDs):
                        </span>{' '}
                        {mc.idsWithoutMaterial.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>

      {/* OBD Match Check */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-primary shrink-0" />
            <CardTitle className="text-sm font-medium">Ökobaudat Verknüpfung</CardTitle>
          </div>
          <StatusIcon status={result.totalIfcMaterials === 0 ? 'warn' : result.obdMatchCount === result.totalIfcMaterials ? 'ok' : result.obdMatchCount > 0 ? 'warn' : 'error'} />
        </CardHeader>
        <CardContent className="space-y-3">
          {result.totalIfcMaterials === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Materialien im Modell gefunden.</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">1:1 Übereinstimmung:</span>
                <span>
                  <span className="font-medium">{result.obdMatchCount}</span>
                  <span className="text-muted-foreground"> / {result.totalIfcMaterials} Materialien</span>
                </span>
              </div>
              <Progress value={Math.round((result.obdMatchCount / result.totalIfcMaterials) * 100)} className="h-2" />

              <div className="space-y-2 mt-4">
                {result.matchingMaterials?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-green-600">Verknüpft ({result.matchingMaterials.length}):</p>
                    <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 max-h-24 overflow-y-auto">
                      {result.matchingMaterials.join(', ')}
                    </div>
                  </div>
                )}
                {result.unmatchedMaterials?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-yellow-600">Nicht verknüpft ({result.unmatchedMaterials.length}):</p>
                    <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 max-h-24 overflow-y-auto">
                      {result.unmatchedMaterials.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
