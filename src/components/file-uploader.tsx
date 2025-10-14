"use client";

import { useState, type DragEvent, type ChangeEvent } from 'react';
import { UploadCloud } from 'lucide-react';
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
    <Card className="w-full max-w-lg mx-auto shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-headline">Neue Analyse starten</CardTitle>
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
            isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
          )}
        >
          <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center">
            <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="font-semibold">Ziehen Sie Ihre .ifc-Datei hierher</p>
            <p className="text-sm text-muted-foreground">oder klicken Sie zum Durchsuchen</p>
            <Input id="file-upload" type="file" className="hidden" accept=".ifc" onChange={handleFileChange} disabled={isLoading}/>
          </label>
        </div>
        {file && (
          <div className="text-center space-y-4 pt-2">
            <p>Ausgewählte Datei: <span className="font-semibold">{file.name}</span></p>
            <Button className="w-full" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? 'Analysiere...' : 'Projekt analysieren'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
