'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { FileUploader } from './file-uploader';
import { Building, FilePlus, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import type { IFCModel } from '@/lib/types';

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
              <button
                key={project.id}
                onClick={() => onSelectProject(project)}
                className="w-full text-left p-4 rounded-lg border hover:bg-accent transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold">{project.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    Hochgeladen vor {formatDistanceToNow(project.uploadDate.toDate(), { locale: de })}
                  </p>
                </div>
                <Building className="w-5 h-5 text-muted-foreground" />
              </button>
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
