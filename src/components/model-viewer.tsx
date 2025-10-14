import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ZoomIn, ZoomOut, Expand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';

interface ModelViewerProps {
  file: File;
}

export function ModelViewer({ file }: ModelViewerProps) {
  const viewerImage = PlaceHolderImages.find(p => p.id === 'model-viewer-placeholder');

  if (!viewerImage) {
    return (
        <Card className="h-full flex flex-col items-center justify-center">
            <CardHeader>
                <CardTitle className="font-headline">3D-Modell-Ansicht</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Bild-Platzhalter nicht gefunden.</p>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col min-h-[400px] md:min-h-0">
      <CardHeader>
        <CardTitle className="font-headline">3D-Modell-Ansicht</CardTitle>
        <CardDescription>Interaktive Ansicht Ihres BIM-Modells.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 relative">
        <Image
          src={viewerImage.imageUrl}
          alt={viewerImage.description}
          data-ai-hint={viewerImage.imageHint}
          fill
          className="object-cover rounded-md"
          priority
        />
        <div className="absolute top-2 right-2 flex flex-col gap-2">
          <Button variant="secondary" size="icon" className="bg-card/80 backdrop-blur-sm hover:bg-card">
            <ZoomIn />
            <span className="sr-only">Vergrößern</span>
          </Button>
          <Button variant="secondary" size="icon" className="bg-card/80 backdrop-blur-sm hover:bg-card">
            <ZoomOut />
            <span className="sr-only">Verkleinern</span>
          </Button>
          <Button variant="secondary" size="icon" className="bg-card/80 backdrop-blur-sm hover:bg-card">
            <Expand />
            <span className="sr-only">Erweitern</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
