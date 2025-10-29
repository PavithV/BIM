'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Layers, Construction } from 'lucide-react';

interface ModelViewerProps {
  ifcContent: string | null;
}

export function ModelViewer({ ifcContent }: ModelViewerProps) {

  const renderOverlay = () => {
    if (!ifcContent) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-md text-center p-4">
          <Layers className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="font-semibold">Kein Modell ausgewählt</p>
          <p className="text-sm text-muted-foreground">Wählen Sie ein Projekt aus, um die 3D-Ansicht zu laden.</p>
        </div>
      );
    }
    
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-md text-center p-4">
          <Construction className="w-8 h-8 mx-auto text-amber-500 mb-2" />
          <p className="font-semibold text-amber-600">3D-Viewer in Arbeit</p>
          <p className="text-sm text-muted-foreground">Die 3D-Modellansicht ist für dieses Projekt bald verfügbar. Die Analysefunktionen sind davon nicht betroffen.</p>
        </div>
      );
  };

  return (
    <Card className="h-full flex flex-col min-h-[400px] md:min-h-0">
      <CardHeader>
        <CardTitle className="font-headline">3D-Modell-Ansicht</CardTitle>
        <CardDescription>Interaktive Ansicht Ihres BIM-Modells.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 relative">
        <div className="w-full h-full rounded-md bg-muted/30"></div>
        {renderOverlay()}
      </CardContent>
    </Card>
  );
}
