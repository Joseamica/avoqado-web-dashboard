import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Button } from '../../components/ui/button'
import { MessageSquare, X, Send, Loader2, ThumbsUp, ThumbsDown, Trash2, History, Plus, Save, Archive } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card'
import { Form, FormControl, FormField, FormItem } from '../../components/ui/form'
import { Input } from '../../components/ui/input'
import { useForm } from 'react-hook-form'
import { useToast } from '../../hooks/use-toast'
import { sendChatMessage, clearConversationHistory, getUsageStats, getConversationHistory, addMessageToHistory, getSavedConversations, loadConversation, deleteConversation, createNewConversation, saveConversation, getCurrentConversationId } from '../../services/chatService'
import { useMutation } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

// Define types for chat messages
interface ChatMessage {
  id: string
  text: string
  isUser: boolean
  timestamp: Date
  cached?: boolean
}

// Helper function to convert conversation history to chat messages
function convertHistoryToMessages(history: any[]): ChatMessage[] {
  const messages: ChatMessage[] = []
  
  console.log('🔄 Converting history to messages:', {
    historyLength: history.length,
    historyPreview: history.slice(0, 3),
  })
  
  // Add welcome message if no history exists
  if (history.length === 0) {
    const welcomeMessage = {
      id: 'welcome',
      text: '¡Hola! Soy el asistente de Avoqado. ¿En qué puedo ayudarte?',
      isUser: false,
      timestamp: new Date(),
    }
    messages.push(welcomeMessage)
    console.log('👋 No history found, adding welcome message')
  } else {
    // Add welcome message first, then history
    messages.push({
      id: 'welcome',
      text: '¡Hola! Soy el asistente de Avoqado. ¿En qué puedo ayudarte?',
      isUser: false,
      timestamp: new Date(Date.now() - (history.length + 1) * 1000), // Make it older
    })
    
    // Convert history entries to chat messages
    history.forEach((entry, index) => {
      if (entry && entry.content && entry.role) {
        messages.push({
          id: `history-${index}-${entry.role}`,
          text: entry.content,
          isUser: entry.role === 'user',
          timestamp: new Date(entry.timestamp),
          cached: false,
        })
      }
    })
    
    console.log('✅ History converted, total messages:', messages.length)
  }
  
  return messages
}

// Chat interface component inside the same file to avoid TypeScript module errors
function ChatInterface({ onClose }: { onClose: () => void }) {
  const [showConversations, setShowConversations] = useState(false)
  const [savedConversations, setSavedConversations] = useState(() => getSavedConversations())
  const [currentConversationId, setCurrentConversationId] = useState(() => getCurrentConversationId())
  // Initialize messages with conversation history
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const history = getConversationHistory()
      return convertHistoryToMessages(history)
    } catch (error) {
      console.warn('Error loading chat history:', error)
      return [
        {
          id: 'welcome',
          text: '¡Hola! Soy el asistente de Avoqado. ¿En qué puedo ayudarte?',
          isUser: false,
          timestamp: new Date(),
        },
      ]
    }
  })
  const [messagesEndRef, setMessagesEndRef] = useState<HTMLDivElement | null>(null)
  const [isClearing, setIsClearing] = useState(false) // Prevent multiple clear operations
  const { toast } = useToast()

  // Memoize usage stats to prevent constant re-renders
  const usageStats = useMemo(() => getUsageStats(), [messages.length])

  const form = useForm({
    defaultValues: {
      message: '',
    },
  })

  // Use TanStack Query mutation for chat messages
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      // Debug: verificar estado de autenticación antes de enviar
      console.log('Enviando mensaje al asistente:', message)
      return await sendChatMessage(message)
    },
    onError: (error: Error) => {
      console.error('Chat error:', error)
      // Debounce toast errors to prevent spam
      const debounceKey = `chat_error_${Date.now()}`
      if (!window[`__chat_error_${error.message}`]) {
        window[`__chat_error_${error.message}`] = true
        toast({
          variant: 'destructive',
          title: 'Error del Asistente',
          description: error.message || 'No se pudo enviar el mensaje. Intenta de nuevo.',
        })
        // Clear debounce after 2 seconds
        setTimeout(() => {
          delete window[`__chat_error_${error.message}`]
        }, 2000)
      }
    },
  })

  // Use useCallback to memoize functions
  const scrollToBottom = useCallback(() => {
    messagesEndRef?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesEndRef])

  const clearingRef = useRef(false)

  // === FUNCIONES DE GESTIÓN DE CONVERSACIONES ===
  
  const handleClearHistory = useCallback(() => {
    if (clearingRef.current) {
      console.log('🚫 Clear operation already in progress')
      return
    }

    try {
      clearingRef.current = true
      setIsClearing(true)
      
      const confirmed = window.confirm('¿Estás seguro que quieres borrar el historial de la conversación?')
      
      if (confirmed) {
        console.log('🗑️ Starting chat history clear operation')
        
        clearConversationHistory()
        setCurrentConversationId(null)
        
        // Reset to welcome message only
        const welcomeMessage = {
          id: 'welcome',
          text: '¡Hola! Soy el asistente de Avoqado. ¿En qué puedo ayudarte?',
          isUser: false,
          timestamp: new Date(),
        }
        
        setMessages([welcomeMessage])
        
        console.log('✅ Chat history cleared successfully')
        
        toast({
          title: 'Historial borrado',
          description: 'El historial de conversación ha sido borrado.',
        })
      }
    } catch (error) {
      console.error('❌ Error clearing chat history:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo borrar el historial. Intenta de nuevo.',
      })
    } finally {
      // Use setTimeout to prevent immediate re-execution
      setTimeout(() => {
        clearingRef.current = false
        setIsClearing(false)
      }, 100)
    }
  }, [toast])
  
  const handleSaveConversation = useCallback(() => {
    const currentHistory = getConversationHistory()
    if (currentHistory.length <= 1) {
      toast({
        variant: 'destructive',
        title: 'No hay nada que guardar',
        description: 'Necesitas tener al menos una conversación para guardarla.',
      })
      return
    }
    
    const conversationId = saveConversation()
    if (conversationId) {
      setCurrentConversationId(conversationId)
      setSavedConversations(getSavedConversations())
      toast({
        title: 'Conversación guardada',
        description: 'La conversación ha sido guardada exitosamente.',
      })
    }
  }, [toast])
  
  const handleNewConversation = useCallback(() => {
    createNewConversation()
    setCurrentConversationId(null)
    setSavedConversations(getSavedConversations())
    
    // Reload messages
    const welcomeMessage = {
      id: 'welcome',
      text: '¡Hola! Soy el asistente de Avoqado. ¿En qué puedo ayudarte?',
      isUser: false,
      timestamp: new Date(),
    }
    setMessages([welcomeMessage])
    
    toast({
      title: 'Nueva conversación',
      description: 'Se ha creado una nueva conversación.',
    })
  }, [toast])
  
  const handleLoadConversation = useCallback((conversationId: string) => {
    if (loadConversation(conversationId)) {
      const history = getConversationHistory()
      const convertedMessages = convertHistoryToMessages(history)
      setMessages(convertedMessages)
      setCurrentConversationId(conversationId)
      setShowConversations(false)
      
      const conversation = savedConversations.find(conv => conv.id === conversationId)
      toast({
        title: 'Conversación cargada',
        description: `Se ha cargado: ${conversation?.title}`,
      })
    }
  }, [savedConversations, toast])
  
  const handleDeleteConversation = useCallback((conversationId: string) => {
    const conversation = savedConversations.find(conv => conv.id === conversationId)
    const confirmed = window.confirm(`¿Estás seguro que quieres eliminar "${conversation?.title}"?`)
    
    if (confirmed && deleteConversation(conversationId)) {
      setSavedConversations(getSavedConversations())
      
      // Si es la conversación actual, resetear
      if (conversationId === currentConversationId) {
        const welcomeMessage = {
          id: 'welcome',
          text: '¡Hola! Soy el asistente de Avoqado. ¿En qué puedo ayudarte?',
          isUser: false,
          timestamp: new Date(),
        }
        setMessages([welcomeMessage])
        setCurrentConversationId(null)
      }
      
      toast({
        title: 'Conversación eliminada',
        description: `Se ha eliminado: ${conversation?.title}`,
      })
    }
  }, [savedConversations, currentConversationId, toast])

  // Scroll to bottom when new messages are added
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Add debug logging and sync check
  useEffect(() => {
    const history = getConversationHistory()
    console.log('📚 Chat history status:', {
      historyLength: history.length,
      messagesLength: messages.length,
      lastHistoryEntry: history[history.length - 1],
      lastMessage: messages[messages.length - 1],
    })
    
    // Additional logging for troubleshooting
    if (history.length > 0) {
      console.log('💾 Current localStorage history:', history)
    }
  }, [messages.length])

  const onSubmit = async (values: { message: string }) => {
    if (!values.message.trim()) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text: values.message,
      isUser: true,
      timestamp: new Date(),
    }

    // Add user message to UI and localStorage immediately
    setMessages(prev => [...prev, userMessage])
    addMessageToHistory('user', values.message)
    form.reset()

    // Use TanStack Query mutation to send the message
    chatMutation.mutate(values.message, {
      onSuccess: result => {
        const botMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          text: result.response,
          isUser: false,
          timestamp: new Date(),
          cached: result.cached,
        }

        // Add bot message to UI and localStorage
        setMessages(prev => [...prev, botMessage])
        addMessageToHistory('assistant', result.response)

        // Show cache indicator if response was cached (debounced)
        if (result.cached && !window.__cache_toast_shown) {
          window.__cache_toast_shown = true
          toast({
            title: 'Respuesta desde cache',
            description: 'Esta respuesta se obtuvo del cache local para ahorrar recursos.',
          })
          // Reset cache toast after 5 seconds
          setTimeout(() => {
            delete window.__cache_toast_shown
          }, 5000)
        }

        console.log('✅ Message exchange completed and saved to history')
      },
    })
  }
  return (
    <Card className={`w-80 sm:w-96 absolute bottom-20 right-0 shadow-lg theme-transition bg-card`}>
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-medium">
          Asistente Avoqado
          <span className="text-xs text-muted-foreground ml-2">({usageStats.remainingRequests} consultas restantes)</span>
        </CardTitle>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowConversations(!showConversations)}
            aria-label="Ver conversaciones"
            title="Ver conversaciones guardadas"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleSaveConversation}
            aria-label="Guardar conversación"
            title="Guardar conversación actual"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleNewConversation}
            aria-label="Nueva conversación"
            title="Crear nueva conversación"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleClearHistory}
            disabled={isClearing}
            aria-label="Borrar historial"
            title="Borrar historial"
          >
            {isClearing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
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
        {showConversations ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Conversaciones Guardadas</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConversations(false)}
              >
                Volver al Chat
              </Button>
            </div>
            {savedConversations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay conversaciones guardadas aún.
              </p>
            ) : (
              savedConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors ${
                    conversation.id === currentConversationId ? 'bg-accent border-primary' : 'bg-card'
                  }`}
                  onClick={() => handleLoadConversation(conversation.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">{conversation.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {conversation.lastMessage}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {conversation.timestamp.toLocaleDateString()} {conversation.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-2 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteConversation(conversation.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-lg theme-transition ${
                  message.isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {message.cached && (
                    <span className="text-xs px-1 rounded border bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200">
                      Cache
                    </span>
                  )}
                </div>
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
        )}
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
                      className="border-input bg-background text-foreground"
                      {...field}
                      disabled={chatMutation.isPending}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" size="icon" disabled={chatMutation.isPending}>
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
    setIsOpen(prev => !prev)
  }

  return (
    <div className="fixed bottom-4 right-20 z-50">
      {isOpen && <ChatInterface key={`chat-${venueId}`} onClose={() => setIsOpen(false)} />}

      <Button
        onClick={toggleChat}
        size="icon"
        variant="default"
        className={`h-14 w-14 rounded-full shadow-lg theme-transition`}
        aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat'}
      >
        <MessageSquare className="h-6 w-6 text-primary-foreground" />
      </Button>
    </div>
  )
}
