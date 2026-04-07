"use client";

import { useState, type DragEvent, type ChangeEvent } from 'react';
import { UploadCloud, Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { tr, type Language } from '@/lib/i18n';

interface FileUploaderProps {
  language: Language;
  // Wir brauchen den string-Parameter eigentlich gar nicht mehr, 
  // aber ich lasse ihn als 'null' kompatibel, damit du dashboard.tsx nicht sofort ändern musst.
  onFileUploaded: (file: File, data: string | null) => void;
  isUploading: boolean;
  onCancel?: () => void;
  showCancelButton?: boolean;
}

export function FileUploader({ language, onFileUploaded, isUploading, onCancel, showCancelButton = false }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // isLoadingFile wird eigentlich nicht mehr gebraucht, da wir nicht mehr "readen"
  const { toast } = useToast();

  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile) {
      if (selectedFile.name.toLowerCase().endsWith('.ifc')) {
        setFile(selectedFile);
      } else {
        toast({
          title: tr(language, 'Ungültiger Dateityp', 'Invalid file type'),
          description: tr(language, 'Bitte laden Sie eine gültige .ifc-Datei hoch.', 'Please upload a valid .ifc file.'),
          variant: 'destructive',
        });
        setFile(null);
      }
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files?.[0] ?? null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files?.[0] ?? null);
  };

  const handleDragEvents = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  // --- HIER IST DER FIX ---
  const handleSubmit = () => {
    if (file) {
      // Wir übergeben IMMER das rohe File-Objekt.
      // Keine Base64 Konvertierung mehr notwendig für Supabase Storage.
      onFileUploaded(file, null);
    }
  };

  const totalIsLoading = isUploading; // isLoadingFile entfernt

  return (
    <Card className="w-full max-w-lg mx-auto bg-card/80 backdrop-blur-sm border-dashed shadow-none">
      <CardHeader className="text-center">
        <CardTitle className="text-xl font-headline">{tr(language, 'Neue Analyse starten', 'Start a new analysis')}</CardTitle>
        <CardDescription>{tr(language, 'Laden Sie Ihr IFC-Modell hoch, um zu beginnen.', 'Upload your IFC model to begin.')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDrop={handleDrop}
          onDragEnter={handleDragEvents}
          onDragLeave={handleDragEvents}
          onDragOver={handleDragEvents}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            isDragging ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'
          )}
        >
          <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center">
            <UploadCloud className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-semibold text-sm">{tr(language, 'Ziehen Sie Ihre .ifc-Datei hierher', 'Drag your .ifc file here')}</p>
            <p className="text-xs text-muted-foreground mt-1">{tr(language, 'oder klicken Sie zum Durchsuchen', 'or click to browse')}</p>
            <Input id="file-upload" type="file" className="hidden" accept=".ifc" onChange={handleFileChange} disabled={totalIsLoading} />
          </label>
        </div>
        {file && (
          <div className="text-center space-y-4 pt-2">
            <p className="text-sm">{tr(language, 'Ausgewählt:', 'Selected:')} <span className="font-semibold">{file.name}</span></p>
            <Button className="w-full" onClick={handleSubmit} disabled={totalIsLoading}>
              {totalIsLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tr(language, 'Verarbeite...', 'Processing...')}
                </>
              ) : tr(language, 'Projekt erstellen & analysieren', 'Create and analyze project')}
            </Button>
          </div>
        )}
        {showCancelButton && onCancel && (
          <Button variant="ghost" className="w-full" onClick={onCancel} disabled={totalIsLoading}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tr(language, 'Zurück zur Projektliste', 'Back to project list')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}