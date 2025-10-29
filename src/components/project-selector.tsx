'use client';

import { useState } from 'react';
import { collection, query, orderBy, getDocs, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';
import { Button } from './ui/button';
import { FileUploader } from './file-uploader';
import { Building, FilePlus, Loader2, Trash2, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import type { IFCModel } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

interface ProjectSelectorProps {
  projects: IFCModel[];
  isLoading: boolean;
  onSelectProject: (project: IFCModel | null) => void;
  onUploadNew: (file: File, fileContent: string) => Promise<void>;
  onDeleteProject: () => Promise<void>;
  activeProjectId?: string | null;
}

export function ProjectSelector({ projects, isLoading, onSelectProject, onUploadNew, onDeleteProject, activeProjectId }: ProjectSelectorProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [showUploader, setShowUploader] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleDeleteProject = async (projectId: string) => {
    if (!user || !firestore) return;

    try {
      // If the deleted project is the active one, clear the view
      if (activeProjectId === projectId) {
        onSelectProject(null);
      }

      // Delete all messages in the subcollection
      const messagesRef = collection(firestore, 'users', user.uid, 'ifcModels', projectId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      const batch = writeBatch(firestore);
      messagesSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Delete the project document itself
      const projectRef = doc(firestore, 'users', user.uid, 'ifcModels', projectId);
      await deleteDoc(projectRef);

      // Trigger a refetch in the parent component
      await onDeleteProject();

    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };
  
  const handleFileUploaded = async (file: File, fileContent: string) => {
    setIsUploading(true);
    await onUploadNew(file, fileContent);
    // The dashboard will handle setting the new active project
    setShowUploader(false);
    setIsUploading(false);
  };

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-sm">Lade Projekte...</p>
        </div>
    );
  }

  if (showUploader || projects.length === 0) {
    return (
      <div className="p-2">
        <FileUploader 
          onFileUploaded={handleFileUploaded} 
          isUploading={isUploading}
          onCancel={() => setShowUploader(false)}
          showCancelButton={projects.length > 0}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-2 flex-1 overflow-y-auto px-2">
        {projects.map(project => (
          <div
            key={project.id}
            className={cn(
              "w-full text-left p-3 rounded-lg border flex items-center justify-between transition-all cursor-pointer",
              activeProjectId === project.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
            )}
          >
            <div
                onClick={() => onSelectProject(project)}
                className="flex-grow flex items-center gap-3 overflow-hidden"
            >
              <div className="flex-shrink-0">
                {activeProjectId === project.id ? (
                    <CheckCircle className="w-5 h-5 text-primary" />
                ) : (
                    <Building className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-grow overflow-hidden">
                  <p className="font-medium text-sm truncate">{project.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.uploadDate?.toDate ? 
                      `vor ${formatDistanceToNow(project.uploadDate.toDate(), { locale: de })}` :
                      'Wird erstellt...'
                    }
                  </p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive w-7 h-7">
                  <Trash2 className="w-4 h-4" />
                  <span className="sr-only">Projekt löschen</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sind Sie sicher?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Diese Aktion kann nicht rückgängig gemacht werden. Dadurch werden das Projekt '{project.fileName}' und alle zugehörigen Chat-Nachrichten endgültig gelöscht.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDeleteProject(project.id)} className="bg-destructive hover:bg-destructive/90">
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
      </div>
      <div className="mt-4 px-2">
        <Button className="w-full" variant="outline" onClick={() => setShowUploader(true)}>
          <FilePlus className="mr-2 h-4 w-4" />
          Neues Projekt starten
        </Button>
      </div>
    </div>
  );
}
