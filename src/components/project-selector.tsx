'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
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
  onSelectProject: (project: IFCModel) => void;
  onUploadNew: (file: File, fileContent: string) => Promise<void>;
  activeProjectId?: string | null;
}

export function ProjectSelector({ onSelectProject, onUploadNew, activeProjectId }: ProjectSelectorProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [projects, setProjects] = useState<IFCModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);

  const fetchProjects = async () => {
    if (!user || !firestore) return;
    setIsLoading(true);
    try {
      const projectsRef = collection(firestore, 'users', user.uid, 'ifcModels');
      const q = query(projectsRef, orderBy('uploadDate', 'desc'));
      const querySnapshot = await getDocs(q);
      const userProjects = querySnapshot.docs.map(doc => doc.data() as IFCModel);
      setProjects(userProjects);
      if (userProjects.length === 0 && !showUploader) {
        setShowUploader(true);
      }
    } catch (error) {
      console.error("Error fetching projects: ", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user, firestore]);

  const handleDeleteProject = async (projectId: string) => {
    if (!user || !firestore) return;

    try {
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

      // Update the local state
      setProjects(projects.filter(p => p.id !== projectId));

    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };
  
  const handleFileUploaded = async (file: File, fileContent: string) => {
    await onUploadNew(file, fileContent);
    await fetchProjects(); // Refetch projects to include the new one
    setShowUploader(false); // Go back to the project list
  };

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-sm">Lade Projekte...</p>
        </div>
    );
  }

  if (showUploader) {
    return <div className="p-2"><FileUploader onFileUploaded={handleFileUploaded} /></div>;
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
                className="flex-grow flex items-center gap-3"
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
                    vor {formatDistanceToNow(project.uploadDate.toDate(), { locale: de })}
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
