'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, CornerDownLeft, Loader2, Send, Sparkles, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './ui/card';
import type { Message } from './dashboard';
import { Skeleton } from './ui/skeleton';

interface ChatAssistantProps {
  messages: Message[];
  startingPrompts: string[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
}

export function ChatAssistant({ messages, startingPrompts, isLoading, onSendMessage }: ChatAssistantProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);


  const handleSendMessage = (prompt?: string) => {
    const userQuestion = prompt || input;
    if (!userQuestion.trim()) return;
    onSendMessage(userQuestion);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const ChatContent = () => {
    if (isLoading && messages.length === 0) {
      return (
        <div className="p-4 space-y-4">
          <Skeleton className="h-16 w-2/3" />
          <Skeleton className="h-16 w-1/2 ml-auto" />
          <Skeleton className="h-20 w-3/4" />
        </div>
      );
    }
    
    if (messages.length === 0) {
      return (
        <Card className="bg-transparent border-none shadow-none">
          <CardContent className="p-0">
              <div className="text-center p-8">
                <Avatar className="mx-auto mb-4 w-16 h-16">
                  <AvatarFallback className="bg-primary/10">
                    <Bot className="w-8 h-8 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-lg font-semibold font-headline">KI-Coach</h2>
                <p className="text-muted-foreground text-sm mb-6">Fragen Sie mich alles über Ihr Modell.</p>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground font-semibold flex items-center justify-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Probieren Sie einen Vorschlag aus</p>
                  {startingPrompts.slice(0, 3).map((prompt, index) => (
                    <button key={index} onClick={() => handleSendMessage(prompt)} className="text-left p-3 rounded-md hover:bg-muted w-full transition-colors text-foreground/80">
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <div className="p-4 space-y-6">
        {messages.map((message) => (
          <div key={message.id} className={cn('flex items-start gap-3', message.role === 'user' ? 'justify-end' : '')}>
            {message.role === 'assistant' && (
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/10">
                  <Bot className="w-4 h-4 text-primary"/>
                </AvatarFallback>
              </Avatar>
            )}
            <div className={cn('max-w-[85%] rounded-lg p-3', message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
            {message.role === 'user' && (
              <Avatar className="w-8 h-8">
                <AvatarFallback>
                  <User className="w-4 h-4"/>
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
         {isLoading && (
            <div className="flex items-start gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/10">
                  <Bot className="w-4 h-4 text-primary"/>
                </AvatarFallback>
              </Avatar>
              <div className="max-w-[85%] rounded-lg p-3 bg-muted flex items-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="text-sm">Denke...</span>
              </div>
            </div>
          )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <ChatContent />
        <div ref={messagesEndRef} />
      </ScrollArea>
      <div className="p-4 border-t bg-card">
        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Fragen zu Nachhaltigkeit, Barrierefreiheit, etc."
            className="pr-24 min-h-[50px] resize-none"
            rows={1}
            disabled={isLoading}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Button type="submit" size="icon" onClick={() => handleSendMessage()} disabled={isLoading || !input.trim()}>
              <Send className="w-4 h-4" />
              <span className="sr-only">Nachricht senden</span>
            </Button>
            <kbd className="hidden lg:inline-flex items-center gap-1 text-xs text-muted-foreground"><CornerDownLeft className="w-3 h-3"/> Enter</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

    