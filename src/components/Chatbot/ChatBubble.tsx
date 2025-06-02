import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '../../components/ui/button'
import { MessageSquare, X, Send, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card'
import { Form, FormControl, FormField, FormItem } from '../../components/ui/form'
import { Input } from '../../components/ui/input'
import { useForm } from 'react-hook-form'
import { useToast } from '../../hooks/use-toast'
import { sendChatMessage, initializeChatSession, resetChatSession } from '../../services/chatService'
import { useTheme } from '../../context/ThemeContext'
import { useMutation } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../theme.css'

// Define types for chat messages
interface ChatMessage {
  id?: string
  text: string
  isUser: boolean
  timestamp: Date
}

// Chat interface component inside the same file to avoid TypeScript module errors
function ChatInterface({ onClose }: { onClose: () => void }) {
  const { isDark } = useTheme()
  const { venueId } = useParams()
  const { user, checkFeatureAccess } = useAuth()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      text: '¡Hola! Soy el asistente de Avoqado. ¿En qué puedo ayudarte?',
      isUser: false,
      timestamp: new Date(),
    },
  ])
  const [messagesEndRef, setMessagesEndRef] = useState<HTMLDivElement | null>(null)
  const { toast } = useToast()

  const form = useForm({
    defaultValues: {
      message: '',
    },
  })

  // Initialize session
  const initSessionMutation = useMutation({
    mutationFn: async () => {
      if (!venueId) throw new Error('No venue ID provided')
      return initializeChatSession(user?.id || `anonymous-${Date.now()}`, venueId)
    },
    onSuccess: sid => {
      setSessionId(sid)
      console.log('Chat session initialized with ID:', sid)
    },
    onError: error => {
      console.error('Session initialization error:', error)
      toast({
        variant: 'destructive',
        title: 'Error de conexión',
        description: 'No se pudo inicializar la sesión de chat.',
      })
    },
  })

  // Use TanStack Query mutation for chat messages
  const chatMutation = useMutation({
    mutationFn: sendChatMessage,
    onError: error => {
      console.error('Chat error:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo enviar el mensaje. Intenta de nuevo.',
      })
    },
  })

  // Initialize chat session when component mounts
  useEffect(() => {
    if (venueId && !sessionId) {
      initSessionMutation.mutate()
    }
  }, [venueId, sessionId, initSessionMutation])

  // Use useCallback to memoize the scroll function
  const scrollToBottom = useCallback(() => {
    messagesEndRef?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesEndRef])

  // Scroll to bottom when new messages are added
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const onSubmit = async (values: { message: string }) => {
    if (!values.message.trim()) return

    const userMessage: ChatMessage = {
      text: values.message,
      isUser: true,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    form.reset()

    if (!venueId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se puede enviar el mensaje sin un ID de venue.',
      })
      return
    }

    // Ensure we have a session
    if (!sessionId) {
      try {
        const sid = await initSessionMutation.mutateAsync()
        setSessionId(sid)
      } catch (error) {
        console.error('Failed to initialize session:', error)
        return
      }
    }

    // Use TanStack Query mutation to send the message with sessionId
    chatMutation.mutate(
      {
        message: values.message,
        venueId, // Include the venueId from the route params
        sessionId: sessionId as string,
      },
      {
        onSuccess: response => {
          const botMessage: ChatMessage = {
            text: response,
            isUser: false,
            timestamp: new Date(),
          }

          setMessages(prev => [...prev, botMessage])
        },
      },
    )
  }
  return (
    <Card className={`w-80 sm:w-96 absolute bottom-20 right-0 shadow-lg theme-transition ${isDark ? 'card' : ''}`}>
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-medium">Asistente Avoqado</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${isDark ? 'hover:bg-gray-800' : ''}`}
          onClick={onClose}
          aria-label="Cerrar chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-4 h-80 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-lg theme-transition ${
                  message.isUser
                    ? isDark
                      ? 'bg-gray-700 text-gray-100'
                      : 'bg-primary text-primary-foreground'
                    : isDark
                    ? 'bg-gray-800 text-gray-200'
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
                          title: 'Gracias por tu feedback',
                          description: 'Tu opinión nos ayuda a mejorar',
                        })
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
                          title: 'Gracias por tu feedback',
                          description: 'Tu opinión nos ayuda a mejorar',
                        })
                      }}
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={setMessagesEndRef} />
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full space-x-2">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      placeholder="Escribe tu pregunta..."
                      className={`${isDark ? 'text-gray-100 border-gray-700' : ''}`}
                      {...field}
                      disabled={chatMutation.isPending}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="icon"
              disabled={chatMutation.isPending}
              className={`${isDark ? 'bg-gray-700 hover:bg-gray-600' : ''}`}
            >
              {chatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </Form>
      </CardFooter>
    </Card>
  )
}

export function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const { isDark } = useTheme()
  const { venueId } = useParams()

  // Track previous venue ID to detect changes
  const previousVenueIdRef = useRef<string | undefined>(venueId)
  
  // Effect to close chat when venue changes
  useEffect(() => {
    // If the venue changed and chat is open, close it
    if (previousVenueIdRef.current !== venueId && isOpen) {
      setIsOpen(false)
    }
    
    // Update the ref to the current venue
    previousVenueIdRef.current = venueId
  }, [venueId, isOpen])
  
  // Toggle chat open/closed
  const toggleChat = () => {
    // If we're opening the chat and venue has changed, reset the session
    if (!isOpen && previousVenueIdRef.current !== venueId) {
      resetChatSession()
    }
    setIsOpen(prev => !prev)
  }

  return (
    <div className="fixed bottom-4 right-20 z-50">
      {isOpen && <ChatInterface key={`chat-${venueId}`} onClose={() => setIsOpen(false)} />}

      <Button
        onClick={toggleChat}
        size="icon"
        variant="secondary"
        className={`h-14 w-14 rounded-full shadow-lg theme-transition
          // ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-100' : 'bg-primary hover:bg-primary/90 text-white'}`}
        aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat'}
      >
        <MessageSquare className={`h-6 w-6 ${isDark ? 'text-white' : 'text-black'}`} />
      </Button>
    </div>
  )
}
