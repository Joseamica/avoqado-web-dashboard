import { getIntlLocale } from '@/utils/i18n-locale'
import { useMutation } from '@tanstack/react-query'
import { History, Loader2, Maximize2, Minimize2, Plus, Save, Send, Sparkles, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel } from '../../components/ui/form'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { useToast } from '../../hooks/use-toast'
import {
  addMessageToHistory,
  clearConversationHistory,
  createNewConversation,
  deleteConversation,
  getConversationHistory,
  getCurrentConversationId,
  getSavedConversations,
  getUsageStats,
  loadConversation,
  saveConversation,
  sendChatMessage,
  submitFeedback,
  submitFeedbackWithCorrection,
} from '../../services/chatService'

const isDevEnvironment = import.meta.env.DEV
const devLog = (...args: unknown[]) => {
  if (isDevEnvironment) {
    console.log(...args)
  }
}

// Global flag used to debounce cache toast notifications
declare global {
  interface Window {
    __cache_toast_shown?: boolean
  }
}

// Define types for chat messages
interface ChatMessage {
  id: string
  text: string
  isUser: boolean
  timestamp: Date
  cached?: boolean
  trainingDataId?: string
  feedbackGiven?: 'CORRECT' | 'INCORRECT' | null
}

// Helper function to convert conversation history to chat messages
function convertHistoryToMessages(history: any[], welcomeText: string): ChatMessage[] {
  const messages: ChatMessage[] = []

  devLog('🔄 Converting history to messages:', {
    historyLength: history.length,
    historyPreview: history.slice(0, 3),
  })

  // Add welcome message if no history exists
  if (history.length === 0) {
    const welcomeMessage = {
      id: 'welcome',
      text: welcomeText,
      isUser: false,
      timestamp: new Date(),
      feedbackGiven: null, // Initialize feedback state
    }
    messages.push(welcomeMessage)
    devLog('👋 No history found, adding welcome message')
  } else {
    // Add welcome message first, then history
    messages.push({
      id: 'welcome',
      text: welcomeText,
      isUser: false,
      timestamp: new Date(Date.now() - (history.length + 1) * 1000), // Make it older
      feedbackGiven: null, // Initialize feedback state
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
          trainingDataId: entry.trainingDataId, // Cargar el ID para el feedback
          feedbackGiven: null, // Initialize feedback state
        })
      }
    })

    devLog('✅ History converted, total messages:', messages.length)
  }

  return messages
}

// Chat interface component inside the same file to avoid TypeScript module errors
function ChatInterface({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const venueSlug = slug ?? null
  const [showConversations, setShowConversations] = useState(false)
  const [savedConversations, setSavedConversations] = useState(() => getSavedConversations(venueSlug))
  const [currentConversationId, setCurrentConversationId] = useState(() => getCurrentConversationId())
  const [isExpanded, setIsExpanded] = useState(true)
  // Initialize messages with conversation history
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const history = getConversationHistory(venueSlug)
      return convertHistoryToMessages(history, t('chat.welcome'))
    } catch (error) {
      console.warn('Error loading chat history:', error)
      return [
        {
          id: 'welcome',
          text: t('chat.welcome'),
          isUser: false,
          timestamp: new Date(),
          feedbackGiven: null, // Initialize feedback state
        },
      ]
    }
  })
  const [messagesEndRef, setMessagesEndRef] = useState<HTMLDivElement | null>(null)
  const [isClearing, setIsClearing] = useState(false) // Prevent multiple clear operations
  const [isCreatingNew, setIsCreatingNew] = useState(false) // Prevent multiple new conversation operations
  const [isSaving, setIsSaving] = useState(false) // Prevent multiple save operations
  const [lastSavedMessageCount, setLastSavedMessageCount] = useState(0) // Track last saved state

  // Estados para diálogos de confirmación
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null)

  // Estados para feedback dialog
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<ChatMessage | null>(null)

  const { toast } = useToast()

  // Memoize usage stats; function reads external store, not component state
  const usageStats = useMemo(() => getUsageStats(venueSlug), [venueSlug])

  // Check if there's something to save or clear
  const canSaveConversation = useMemo(() => {
    const hasUserMessages = messages.some(msg => msg.isUser)

    // If no user messages, can't save
    if (!hasUserMessages) return false

    // Count current messages (excluding welcome message)
    const currentMessageCount = messages.filter(msg => msg.id !== 'welcome').length

    // Can save if there are messages and either:
    // 1. It's a new conversation (no ID yet)
    // 2. There are new messages since last save
    return currentMessageCount > 0 && (!currentConversationId || currentMessageCount > lastSavedMessageCount)
  }, [messages, currentConversationId, lastSavedMessageCount])

  const canClearConversation = useMemo(() => {
    const hasUserMessages = messages.some(msg => msg.isUser)
    return hasUserMessages
  }, [messages])

  const form = useForm({
    defaultValues: {
      message: '',
    },
  })

  const feedbackForm = useForm({
    defaultValues: {
      problemDescription: '',
    },
  })

  // Use TanStack Query mutation for chat messages
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      // Debug: verificar estado de autenticación antes de enviar
      devLog('Enviando mensaje al asistente:', message, { venueSlug })
      return await sendChatMessage(message, { venueSlug })
    },
    onError: (error: Error) => {
      console.error('Chat error:', error)
      // Debounce toast errors to prevent spam
      if (!window[`__chat_error_${error.message}`]) {
        window[`__chat_error_${error.message}`] = true
        toast({
          variant: 'destructive',
          title: t('chat.errors.assistantTitle'),
          description: error.message || t('chat.errors.sendFailed'),
        })
        // Clear debounce after 2 seconds
        setTimeout(() => {
          delete window[`__chat_error_${error.message}`]
        }, 2000)
      }
    },
  })

  // Simple positive feedback mutation
  const positiveFeedbackMutation = useMutation({
    mutationFn: ({ trainingDataId, messageId: _messageId }: { trainingDataId: string; messageId: string }) =>
      submitFeedback(trainingDataId, 'CORRECT'),
    onSuccess: (_, variables) => {
      // Update the message to show feedback was given
      setMessages(prev => prev.map(msg => (msg.id === variables.messageId ? { ...msg, feedbackGiven: 'CORRECT' } : msg)))

      toast({
        title: t('chat.feedback.thanksTitle'),
        description: t('chat.feedback.thanksDesc'),
      })
    },
    onError: error => {
      console.error('❌ Error submitting positive feedback:', error)
      toast({
        title: t('common.error', { defaultValue: 'Error' }),
        description: t('chat.feedback.sendError'),
        variant: 'destructive',
      })
    },
  })

  // Detailed negative feedback mutation with correction
  const negativeFeedbackMutation = useMutation({
    mutationFn: ({
      trainingDataId,
      problemDescription,
      originalQuestion,
      messageId: _messageId,
    }: {
      trainingDataId: string
      problemDescription: string
      originalQuestion: string
      messageId: string
    }) => submitFeedbackWithCorrection(trainingDataId, problemDescription, originalQuestion),
    onSuccess: (result, variables) => {
      // Mark original message as having negative feedback
      setMessages(prev => prev.map(msg => (msg.id === variables.messageId ? { ...msg, feedbackGiven: 'INCORRECT' } : msg)))

      // Add corrected response if we got one
      if (result.correctedResponse) {
        const correctedMessage: ChatMessage = {
          id: `corrected-${Date.now()}`,
          text: result.correctedResponse,
          isUser: false,
          timestamp: new Date(),
          cached: false,
          trainingDataId: result.trainingDataId,
          feedbackGiven: null,
        }

        setMessages(prev => [...prev, correctedMessage])
        addMessageToHistory('assistant', result.correctedResponse, venueSlug, result.trainingDataId)
      }

      // Close dialog
      setShowFeedbackDialog(false)
      setFeedbackMessage(null)
      feedbackForm.reset()

      toast({
        title: t('chat.feedback.sentTitle'),
        description: result.correctedResponse ? t('chat.feedback.correctedDesc') : t('chat.feedback.recordedDesc'),
      })
    },
    onError: error => {
      console.error('❌ Error submitting negative feedback:', error)
      toast({
        title: t('common.error', { defaultValue: 'Error' }),
        description: t('chat.feedback.sendError'),
        variant: 'destructive',
      })
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
      devLog('🚫 Clear operation already in progress')
      return
    }

    // Mostrar diálogo de confirmación
    setShowClearConfirm(true)
  }, [])

  const confirmClearHistory = useCallback(() => {
    try {
      clearingRef.current = true
      setIsClearing(true)

      devLog('🗑️ Starting chat history clear operation')

      clearConversationHistory(venueSlug)
      setCurrentConversationId(null)
      setLastSavedMessageCount(0) // Reset save tracking when clearing

      // Reset to welcome message only
      const welcomeMessage = {
        id: 'welcome',
        text: t('chat.welcome'),
        isUser: false,
        timestamp: new Date(),
        feedbackGiven: null, // Initialize feedback state
      }

      setMessages([welcomeMessage])

      devLog('✅ Chat history cleared successfully')

      toast({
        title: t('chat.toast.historyCleared.title'),
        description: t('chat.toast.historyCleared.desc'),
      })
    } catch (error) {
      console.error('❌ Error clearing chat history:', error)
      toast({
        variant: 'destructive',
        title: t('common.error', { defaultValue: 'Error' }),
        description: t('chat.errors.clearFailed', { defaultValue: 'Unable to clear history. Please try again.' }),
      })
    } finally {
      // Use setTimeout to prevent immediate re-execution
      setTimeout(() => {
        clearingRef.current = false
        setIsClearing(false)
      }, 100)
    }
  }, [toast, t, venueSlug])

  const handleSaveConversation = useCallback(async () => {
    if (isSaving) return

    const currentHistory = getConversationHistory(venueSlug)
    if (currentHistory.length <= 1) {
      toast({
        variant: 'destructive',
        title: t('chat.toast.nothingToSave.title', { defaultValue: 'Nothing to save' }),
        description: t('chat.toast.nothingToSave.desc', { defaultValue: 'You need at least one conversation to save it.' }),
      })
      return
    }

    setIsSaving(true)

    try {
      devLog('💾 Intentando guardar conversación:', {
        currentConversationId,
        messageCount: messages.filter(msg => msg.id !== 'welcome').length,
        lastSavedCount: lastSavedMessageCount,
        isUpdate: !!currentConversationId,
        venueSlug,
      })

      const conversationId = await saveConversation(undefined, venueSlug, currentConversationId)

      devLog('✅ Conversación guardada con ID:', conversationId)

      if (conversationId) {
        const wasUpdate = currentConversationId === conversationId
        setCurrentConversationId(conversationId)
        setSavedConversations(getSavedConversations(venueSlug))

        // Update last saved message count to prevent re-saving the same content
        const currentMessageCount = messages.filter(msg => msg.id !== 'welcome').length
        setLastSavedMessageCount(currentMessageCount)

        devLog('📋 Estado actualizado:', {
          wasUpdate,
          newConversationId: conversationId,
          savedCount: currentMessageCount,
        })

        toast({
          title: wasUpdate ? t('chat.toast.conversationUpdated.title') : t('chat.toast.conversationSaved.title'),
          description: wasUpdate ? t('chat.toast.conversationUpdated.desc') : t('chat.toast.conversationSaved.desc'),
        })
      }
    } catch (error) {
      console.error('Error saving conversation:', error)
      toast({
        variant: 'destructive',
        title: t('common.error', { defaultValue: 'Error' }),
        description: t('chat.errors.saveFailed', { defaultValue: 'Could not save the conversation.' }),
      })
    } finally {
      // Add delay to prevent spam clicking
      setTimeout(() => {
        setIsSaving(false)
      }, 1000)
    }
  }, [toast, isSaving, messages, currentConversationId, lastSavedMessageCount, t, venueSlug])

  const handleNewConversation = useCallback(() => {
    if (isCreatingNew) return

    // Check if current conversation has any user messages (more than just welcome)
    const hasUserMessages = messages.some(msg => msg.isUser)

    if (!hasUserMessages) {
      toast({
        title: t('chat.toast.alreadyNew.title'),
        description: t('chat.toast.alreadyNew.desc'),
      })
      return
    }

    setIsCreatingNew(true)

    try {
      createNewConversation(venueSlug)
      setCurrentConversationId(null)
      setSavedConversations(getSavedConversations(venueSlug))
      setLastSavedMessageCount(0) // Reset save tracking for new conversation

      // Reload messages
      const welcomeMessage = {
        id: 'welcome',
        text: t('chat.welcome'),
        isUser: false,
        timestamp: new Date(),
        feedbackGiven: null, // Initialize feedback state
      }
      setMessages([welcomeMessage])

      toast({
        title: t('chat.toast.newConversation.title'),
        description: t('chat.toast.newConversation.desc'),
      })
    } catch (error) {
      console.error('Error creating new conversation:', error)
      toast({
        variant: 'destructive',
        title: t('common.error', { defaultValue: 'Error' }),
        description: t('chat.errors.createConversation'),
      })
    } finally {
      // Add delay to prevent spam clicking
      setTimeout(() => {
        setIsCreatingNew(false)
      }, 1000)
    }
  }, [toast, messages, isCreatingNew, t, venueSlug])

  const handleLoadConversation = useCallback(
    (conversationId: string) => {
      if (loadConversation(conversationId, venueSlug)) {
        const history = getConversationHistory(venueSlug)
        const convertedMessages = convertHistoryToMessages(history, t('chat.welcome'))
        setMessages(convertedMessages)
        setCurrentConversationId(conversationId)
        setShowConversations(false)

        // Set last saved count to current count since we're loading a saved conversation
        const currentMessageCount = convertedMessages.filter(msg => msg.id !== 'welcome').length
        setLastSavedMessageCount(currentMessageCount)

        const conversation = savedConversations.find(conv => conv.id === conversationId)
        toast({
          title: t('chat.toast.conversationLoaded.title'),
          description: t('chat.toast.conversationLoaded.desc', { title: conversation?.title }),
        })
      }
    },
    [savedConversations, toast, t, venueSlug],
  )

  const handleDeleteConversation = useCallback((conversationId: string) => {
    setConversationToDelete(conversationId)
    setShowDeleteConfirm(true)
  }, [])

  const confirmDeleteConversation = useCallback(() => {
    if (!conversationToDelete) return

    const conversation = savedConversations.find(conv => conv.id === conversationToDelete)

    if (deleteConversation(conversationToDelete)) {
      setSavedConversations(getSavedConversations(venueSlug))

      // Si es la conversación actual, resetear
      if (conversationToDelete === currentConversationId) {
        const welcomeMessage = {
          id: 'welcome',
          text: t('chat.welcome'),
          isUser: false,
          timestamp: new Date(),
          feedbackGiven: null, // Initialize feedback state
        }
        setMessages([welcomeMessage])
        setCurrentConversationId(null)
      }

      toast({
        title: t('chat.toast.conversationDeleted.title'),
        description: t('chat.toast.conversationDeleted.desc', { title: conversation?.title }),
      })
    }

    setConversationToDelete(null)
  }, [conversationToDelete, savedConversations, currentConversationId, toast, t, venueSlug])

  // Handle feedback dialog submission
  const handleFeedbackSubmit = useCallback(
    (values: { problemDescription: string }) => {
      if (!feedbackMessage?.trainingDataId) return

      // Find the user question that corresponds to this AI message
      const messageIndex = messages.findIndex(msg => msg.id === feedbackMessage.id)
      const userMessage = messageIndex > 0 ? messages[messageIndex - 1] : null
      const originalQuestion = userMessage?.isUser ? userMessage.text : t('chat.feedback.previousQuestion')

      negativeFeedbackMutation.mutate({
        trainingDataId: feedbackMessage.trainingDataId,
        problemDescription: values.problemDescription,
        originalQuestion,
        messageId: feedbackMessage.id,
      })
    },
    [feedbackMessage, messages, negativeFeedbackMutation, t],
  )

  // Scroll to bottom when new messages are added
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Add debug logging and sync check
  useEffect(() => {
    const history = getConversationHistory(venueSlug)

    devLog('📚 Chat history status:', {
      venueSlug,
      historyLength: history.length,
      messagesLength: messages.length,
      lastHistoryEntry: history[history.length - 1],
      lastMessage: messages[messages.length - 1],
    })

    if (history.length > 0) {
      devLog('💾 Current localStorage history:', history)
    }
  }, [messages, venueSlug])

  const onSubmit = async (values: { message: string }) => {
    if (!values.message.trim()) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text: values.message,
      isUser: true,
      timestamp: new Date(),
      feedbackGiven: null, // Initialize feedback state
    }

    // Add user message to UI and localStorage immediately
    setMessages(prev => [...prev, userMessage])
    addMessageToHistory('user', values.message, venueSlug)
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
          trainingDataId: result.trainingDataId,
          feedbackGiven: null, // Initialize feedback state
        }

        // Debug: Log trainingDataId to console
        devLog('🔍 Bot message trainingDataId:', result.trainingDataId)

        // Add bot message to UI and localStorage
        setMessages(prev => [...prev, botMessage])
        addMessageToHistory('assistant', result.response, venueSlug, result.trainingDataId)

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

        devLog('✅ Message exchange completed and saved to history')
      },
    })
  }
  return (
    <Card
      className={`${
        isExpanded ? 'w-[700px] sm:w-[800px] h-[700px]' : 'w-80 sm:w-96'
      } fixed bottom-20 right-20 z-9999 shadow-lg theme-transition bg-white overflow-hidden border border-border isolate mix-blend-normal`}
    >
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 bg-background">
        <CardTitle className="text-lg font-medium">
          {showConversations ? t('chat.saved.title') : t('chat.title')}
          {!showConversations && (
            <span className="text-xs text-muted-foreground ml-2">
              ({usageStats.remainingRequests} {t('chat.queriesRemaining')})
            </span>
          )}
        </CardTitle>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? t('chat.actions.collapse_chat') : t('chat.actions.expand_chat')}
            title={isExpanded ? t('chat.actions.collapse_chat') : t('chat.actions.expand_chat')}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant={showConversations ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowConversations(!showConversations)}
            aria-label={t('chat.actions.view_conversations')}
            title={t('chat.actions.view_saved_conversations')}
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleSaveConversation}
            disabled={!canSaveConversation || isSaving}
            aria-label={t('chat.actions.save_conversation')}
            title={
              !messages.some(msg => msg.isUser)
                ? t('chat.actions.nothing_to_save')
                : canSaveConversation
                ? t('chat.actions.save_current')
                : t('chat.actions.already_saved')
            }
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleNewConversation}
            disabled={isCreatingNew}
            aria-label={t('chat.actions.new_conversation')}
            title={t('chat.actions.create_new_conversation')}
          >
            {isCreatingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleClearHistory}
            disabled={isClearing || !canClearConversation}
            aria-label={t('chat.actions.clear_history')}
            title={canClearConversation ? t('chat.actions.clear_history') : t('chat.actions.nothing_to_clear')}
          >
            {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label={t('chat.actions.close_chat')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className={`p-4 ${isExpanded ? 'h-[550px]' : 'h-72'} overflow-y-auto bg-background`}>
        {showConversations ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">{t('chat.saved.title')}</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowConversations(false)}>
                {t('chat.saved.back')}
              </Button>
            </div>
            {savedConversations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('chat.saved.empty')}</p>
            ) : (
              savedConversations.map(conversation => (
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
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{conversation.lastMessage}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {conversation.timestamp.toLocaleDateString()}{' '}
                        {conversation.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-2 text-muted-foreground hover:text-destructive"
                      onClick={e => {
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
          <div className="space-y-4 bg-background">
            {messages.map((message, index) => (
              <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg theme-transition ${
                    message.isUser ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground border border-border'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs opacity-70">
                      {message.timestamp.toLocaleTimeString(getIntlLocale(i18n.language), {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {message.cached && (
                      <span className="text-xs px-1 rounded border bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200">
                        {t('chat.labels.cache')}
                      </span>
                    )}
                  </div>
                  {!message.isUser && index > 0 && (
                    <div className="flex items-center space-x-2 mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 w-6 p-0 ${
                          message.feedbackGiven === 'CORRECT'
                            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50'
                            : ''
                        }`}
                        aria-label={t('chat.a11y.positiveFeedback')}
                        onClick={() => {
                          devLog('👍 Thumbs up clicked, trainingDataId:', message.trainingDataId)
                          if (message.trainingDataId) {
                            positiveFeedbackMutation.mutate({
                              trainingDataId: message.trainingDataId,
                              messageId: message.id,
                            })
                          } else {
                            devLog('❌ No trainingDataId found for message:', message)
                            toast({
                              title: t('chat.feedback.unavailableTitle'),
                              description: t('chat.feedback.unavailableDesc'),
                              variant: 'destructive',
                            })
                          }
                        }}
                        disabled={positiveFeedbackMutation.isPending || message.feedbackGiven !== null}
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 w-6 p-0 ${
                          message.feedbackGiven === 'INCORRECT'
                            ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50'
                            : ''
                        }`}
                        aria-label={t('chat.a11y.negativeFeedback')}
                        onClick={() => {
                          devLog('👎 Thumbs down clicked, trainingDataId:', message.trainingDataId)
                          if (message.trainingDataId) {
                            setFeedbackMessage(message)
                            setShowFeedbackDialog(true)
                          } else {
                            devLog('❌ No trainingDataId found for message:', message)
                            toast({
                              title: t('chat.feedback.unavailableTitle'),
                              description: t('chat.feedback.unavailableDesc'),
                              variant: 'destructive',
                            })
                          }
                        }}
                        disabled={negativeFeedbackMutation.isPending || message.feedbackGiven !== null}
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
      <CardFooter className="p-4 pt-2 bg-background flex flex-col gap-1.5">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full space-x-2">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      placeholder={t('chat.input.placeholder')}
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
        <p className="text-[10px] leading-tight text-muted-foreground/60 text-center">
          AI-generated content may be inaccurate. The chatbot is restricted to your current venue and will not disclose internal system
          details. Do not submit sensitive personal data. Learn more in our{' '}
          <Link to="/terms" className="underline hover:text-muted-foreground/80">
            Terms
          </Link>
          {' and '}
          <Link to="/privacy" className="underline hover:text-muted-foreground/80">
            Privacy Policy
          </Link>
          .
        </p>
      </CardFooter>

      {/* Diálogos de confirmación */}
      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title={t('chat.confirm.clear.title')}
        description={t('chat.confirm.clear.desc')}
        confirmText={t('chat.confirm.clear.confirm')}
        cancelText={t('cancel')}
        variant="destructive"
        onConfirm={confirmClearHistory}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('chat.confirm.delete.title')}
        description={t('chat.confirm.delete.desc', {
          title: savedConversations.find(conv => conv.id === conversationToDelete)?.title || '',
        })}
        confirmText={t('chat.confirm.delete.confirm')}
        cancelText={t('cancel')}
        variant="destructive"
        onConfirm={confirmDeleteConversation}
        onCancel={() => setConversationToDelete(null)}
      />

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('chat.feedback.dialog.title')}</DialogTitle>
            <DialogDescription>{t('chat.feedback.dialog.desc')}</DialogDescription>
          </DialogHeader>
          <Form {...feedbackForm}>
            <form onSubmit={feedbackForm.handleSubmit(handleFeedbackSubmit)} className="space-y-4">
              <FormField
                control={feedbackForm.control}
                name="problemDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('chat.feedback.form.label')}</FormLabel>
                    <FormControl>
                      <Textarea placeholder={t('chat.feedback.form.placeholder')} className="min-h-[100px]" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowFeedbackDialog(false)
                    setFeedbackMessage(null)
                    feedbackForm.reset()
                  }}
                >
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={negativeFeedbackMutation.isPending} className="min-w-[120px]">
                  {negativeFeedbackMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t('chat.feedback.sending')}
                    </>
                  ) : (
                    t('chat.feedback.submit')
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const { venueId } = useParams()
  const { t } = useTranslation()

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
    <div className="relative">
      {isOpen && (
        <div className="fixed top-16 right-4 z-50">
          <ChatInterface key={`chat-${venueId}`} onClose={() => setIsOpen(false)} />
        </div>
      )}

      <Button
        onClick={toggleChat}
        size="icon"
        className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200"
        aria-label={isOpen ? t('chat.a11y.close') : t('chat.a11y.open')}
      >
        <Sparkles className="h-5 w-5" />
      </Button>
    </div>
  )
}
