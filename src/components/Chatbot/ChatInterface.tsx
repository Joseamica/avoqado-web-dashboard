import { useState, useRef, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { X, Send, Loader2, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import { sendChatMessage, initializeChatSession, clearChatHistory } from '../../services/chatService';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem } from '../../components/ui/form';
import { useToast } from '../../hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

interface ChatMessage {
  id?: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatInterfaceProps {
  onClose: () => void;
}

interface ChatFormValues {
  message: string;
}

export function ChatInterface({ onClose }: ChatInterfaceProps) {
  const { isDark } = useTheme();
  const { venueId } = useParams();
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      text: '¡Hola! Soy el asistente de Avoqado. ¿En qué puedo ayudarte?',
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const form = useForm<ChatFormValues>({
    defaultValues: {
      message: '',
    },
  });
  
  // Initialize session
  const initSessionMutation = useMutation({
    mutationFn: async () => {
      if (!venueId) throw new Error('No venue ID provided');
      return initializeChatSession(
        user?.id || `anonymous-${Date.now()}`,
        venueId
      );
    },
    onSuccess: (sid) => {
      setSessionId(sid);
      console.log('Chat session initialized with ID:', sid);
    },
    onError: (error) => {
      console.error('Session initialization error:', error);
      toast({
        variant: 'destructive',
        title: 'Error de conexión',
        description: 'No se pudo inicializar la sesión de chat.',
      });
    }
  });
  
  // Use TanStack Query mutation for chat messages
  const chatMutation = useMutation({
    mutationFn: sendChatMessage,
    onError: (error) => {
      console.error('Chat error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo enviar el mensaje. Intenta de nuevo.',
      });
    }
  });
  
  // Initialize chat session when component mounts
  useEffect(() => {
    if (venueId && !sessionId) {
      initSessionMutation.mutate();
    }
  }, [venueId, sessionId, initSessionMutation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const onSubmit = async (values: ChatFormValues) => {
    if (!values.message.trim()) return;

    const userMessage: ChatMessage = {
      text: values.message,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    form.reset();
    
    if (!venueId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se puede enviar el mensaje sin un ID de venue.',
      });
      return;
    }
    
    // Ensure we have a session
    if (!sessionId) {
      try {
        const sid = await initSessionMutation.mutateAsync();
        setSessionId(sid);
      } catch (error) {
        console.error('Failed to initialize session:', error);
        return;
      }
    }
    
    // Use TanStack Query mutation to send the message with venueId and sessionId
    chatMutation.mutate(
      {
        message: values.message,
        venueId, // Include the venueId from route params
        sessionId: sessionId as string
      },
      {
        onSuccess: (response) => {
          console.log('Chat message received:', response);
          
          // Format the response if needed
          const formattedResponse = response;
          
          const botMessage: ChatMessage = {
            text: formattedResponse,
            isUser: false,
            timestamp: new Date(),
          };
          
          setMessages(prev => [...prev, botMessage]);
        }
      }
    );
  };

  return (
    <Card className="w-80 sm:w-96 absolute bottom-20 right-0 shadow-lg">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-medium">Asistente Avoqado</CardTitle>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={async () => {
              if (!venueId) return;
              
              // Confirm with the user
              if (window.confirm('¿Estás seguro que quieres borrar el historial de la conversación?')) {
                const success = await clearChatHistory(venueId);
                
                if (success) {
                  // Reset messages to initial state
                  setMessages([{
                    text: '¡Hola! Soy el asistente de Avoqado. ¿En qué puedo ayudarte?',
                    isUser: false,
                    timestamp: new Date()
                  }]);
                  
                  // Reset session ID
                  setSessionId(null);
                  
                  toast({
                    title: 'Historial borrado',
                    description: 'El historial de conversación ha sido borrado.',
                  });
                } else {
                  toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'No se pudo borrar el historial.',
                  });
                }
              }
            }}
            aria-label="Borrar historial"
            title="Borrar historial"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Cerrar chat"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 h-80 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-lg ${
                  message.isUser
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {!message.isUser && index > 0 && (
                  <div className="flex items-center space-x-2 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      aria-label="Feedback positivo"
                      onClick={() => {
                        toast({
                          title: "Gracias por tu feedback",
                          description: "Tu opinión nos ayuda a mejorar"
                        });
                      }}
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      aria-label="Feedback negativo"
                      onClick={() => {
                        toast({
                          title: "Gracias por tu feedback",
                          description: "Tu opinión nos ayuda a mejorar"
                        });
                      }}
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full space-x-2">
            {/* You can display session status here if needed */}
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      placeholder="Escribe tu pregunta..."
                      className={`${isDark ? 'text-foreground border-border' : ''}`}
                      {...field}
                      disabled={chatMutation.isPending}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" size="icon" disabled={chatMutation.isPending} className={`${isDark ? 'bg-accent hover:bg-accent/80' : ''}`}>
              {chatMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </Form>
      </CardFooter>
    </Card>
  );
}
