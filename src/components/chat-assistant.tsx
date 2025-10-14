'use client';

import { useEffect, useState, useRef } from 'react';
import { Send, Bot, User, CornerDownLeft, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getStartingPrompts, getAIChatFeedback } from '@/app/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './ui/card';

interface ChatAssistantProps {
  ifcData: string;
}

type Message = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
};

export function ChatAssistant({ ifcData }: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [startingPrompts, setStartingPrompts] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchPrompts() {
      const result = await getStartingPrompts();
      if (result.prompts) {
        setStartingPrompts(result.prompts);
      }
    }
    fetchPrompts();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (prompt?: string) => {
    const userQuestion = prompt || input;
    if (!userQuestion.trim()) return;

    const newUserMessage: Message = { id: Date.now(), role: 'user', content: userQuestion };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
    setIsLoading(true);

    const result = await getAIChatFeedback({
      ifcModelData: ifcData,
      userQuestion: userQuestion,
    });

    setIsLoading(false);

    if (result.feedback) {
      const newAssistantMessage: Message = { id: Date.now() + 1, role: 'assistant', content: result.feedback };
      setMessages(prev => [...prev, newAssistantMessage]);
    } else {
      const errorMessage: Message = { id: Date.now() + 1, role: 'assistant', content: result.error || 'Entschuldigung, ein Fehler ist aufgetreten.' };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {messages.length === 0 && !isLoading && (
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
          )}

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
          <div ref={messagesEndRef} />
        </div>
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
