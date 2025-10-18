'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { FileUploader } from './file-uploader';
import { Building, FilePlus, Loader2, Trash2 } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"

interface ProjectSelectorProps {
  onSelectProject: (project: IFCModel) => void;
  onUploadNew: (file: File, fileContent: string) => void;
}

export function ProjectSelector({ onSelectProject, onUploadNew }: ProjectSelectorProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [projects, setProjects] = useState<IFCModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user || !firestore) return;
      setIsLoading(true);
      try {
        const projectsRef = collection(firestore, 'users', user.uid, 'ifcModels');
        const q = query(projectsRef, orderBy('uploadDate', 'desc'));
        const querySnapshot = await getDocs(q);
        const userProjects = querySnapshot.docs.map(doc => doc.data() as IFCModel);
        setProjects(userProjects);
        if (userProjects.length === 0) {
          setShowUploader(true);
        }
      } catch (error) {
        console.error("Error fetching projects: ", error);
      } finally {
        setIsLoading(false);
      }
    };

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

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Lade Projekte...</p>
        </div>
    );
  }

  if (showUploader) {
    return <FileUploader onFileUploaded={onUploadNew} />;
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Projekte</CardTitle>
        <CardDescription>Wählen Sie ein bestehendes Projekt aus oder starten Sie eine neue Analyse.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 mb-4 pr-4">
          <div className="space-y-3">
            {projects.map(project => (
              <div
                key={project.id}
                className="w-full text-left p-4 rounded-lg border flex items-center justify-between"
              >
                <button
                    onClick={() => onSelectProject(project)}
                    className="flex-grow text-left"
                >
                  <div className="flex items-center gap-4">
                    <Building className="w-5 h-5 text-muted-foreground hidden sm:block" />
                    <div>
                        <p className="font-semibold">{project.fileName}</p>
                        <p className="text-sm text-muted-foreground">
                        Hochgeladen vor {formatDistanceToNow(project.uploadDate.toDate(), { locale: de })}
                        </p>
                    </div>
                  </div>
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive">
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
        </ScrollArea>
        <Button className="w-full" onClick={() => setShowUploader(true)}>
          <FilePlus className="mr-2 h-4 w-4" />
          Neues Projekt starten
        </Button>
      </CardContent>
    </Card>
  );
}
