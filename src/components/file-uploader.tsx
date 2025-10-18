"use client";

import { useState, type DragEvent, type ChangeEvent } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFileUploaded: (file: File, data: string) => void;
}

export function FileUploader({ onFileUploaded }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile) {
        if (selectedFile.name.toLowerCase().endsWith('.ifc')) {
            setFile(selectedFile);
        } else {
            toast({
            title: 'Ungültiger Dateityp',
            description: 'Bitte laden Sie eine gültige .ifc-Datei hoch.',
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

  const handleSubmit = () => {
    if (file) {
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e.target?.result as string;
        onFileUploaded(file, fileContent);
        setIsLoading(false);
      };
      reader.onerror = () => {
        toast({
          title: 'Fehler beim Lesen der Datei',
          description: 'Beim Verarbeiten Ihrer Datei ist ein Fehler aufgetreten.',
          variant: 'destructive',
        });
        setIsLoading(false);
      }
      reader.readAsText(file);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto bg-card/80 backdrop-blur-sm border-dashed shadow-none">
      <CardHeader className="text-center">
        <CardTitle className="text-xl font-headline">Neue Analyse starten</CardTitle>
        <CardDescription>Laden Sie Ihr IFC-Modell hoch, um zu beginnen.</CardDescription>
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
            <p className="font-semibold text-sm">Ziehen Sie Ihre .ifc-Datei hierher</p>
            <p className="text-xs text-muted-foreground mt-1">oder klicken Sie zum Durchsuchen</p>
            <Input id="file-upload" type="file" className="hidden" accept=".ifc" onChange={handleFileChange} disabled={isLoading}/>
          </label>
        </div>
        {file && (
          <div className="text-center space-y-4 pt-2">
            <p className="text-sm">Ausgewählt: <span className="font-semibold">{file.name}</span></p>
            <Button className="w-full" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analysiere...
                    </>
                ) : 'Projekt analysieren'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
