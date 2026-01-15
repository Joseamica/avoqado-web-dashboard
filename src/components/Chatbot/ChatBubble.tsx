import { getIntlLocale } from '@/utils/i18n-locale'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BarChart3, ChevronDown, ChevronUp, History, Loader2, Maximize2, Minimize2, MoreVertical, PanelLeft, PanelLeftClose, Plus, Save, Send, Sparkles, ThumbsDown, ThumbsUp, Trash2, X, Zap } from 'lucide-react'
import { useTokenBudget, getTokenWarningLevel, formatTokenCount, tokenBudgetQueryKey, shouldWarnBeforeSending } from '@/hooks/use-token-budget'
import { useChatReferences } from '@/hooks/use-chat-references'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardHeader, CardTitle } from '../../components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel } from '../../components/ui/form'
import { Input } from '../../components/ui/input'
import { Switch } from '../../components/ui/switch'
import { Textarea } from '../../components/ui/textarea'
import { useToast } from '../../hooks/use-toast'
import { ChatChart } from './ChatChart'
import {
  addMessageToHistory,
  clearConversationHistory,
  createNewConversation,
  deleteConversation,
  getConversationHistory,
  getCurrentConversationId,
  getSavedConversations,
  getUsageStats,
  isVisualizationSkipped,
  loadConversation,
  saveConversation,
  sendChatMessage,
  submitFeedback,
  submitFeedbackWithCorrection,
  type VisualizationResult,
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
  visualization?: VisualizationResult
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
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

// Helper function to parse markdown-style bold text (**text**) into Badge components
function parseMessageText(text: string, isUserMessage: boolean): React.ReactNode {
  // Split by **text** pattern, keeping the captured groups
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  if (parts.length === 1) {
    // No bold text found, return as-is
    return text
  }

  return parts.map((part, index) => {
    // Check if this part is a bold text (surrounded by **)
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2)
      return (
        <Badge
          key={index}
          variant={isUserMessage ? 'secondary' : 'default'}
          className="mx-0.5 text-xs py-0.5 px-1.5"
        >
          {content}
        </Badge>
      )
    }
    return part
  })
}

// Chat interface component inside the same file to avoid TypeScript module errors
function ChatInterface({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const { t: tCommon } = useTranslation('common')
  const { slug } = useParams<{ slug: string }>()
  const venueSlug = slug ?? null
  const [showSidebar, setShowSidebar] = useState(true)
  const [savedConversations, setSavedConversations] = useState(() => getSavedConversations(venueSlug))
  const [currentConversationId, setCurrentConversationId] = useState(() => getCurrentConversationId())
  const [isExpanded, setIsExpanded] = useState(true)
  const [showReferencesPanel, setShowReferencesPanel] = useState(true)

  // AI References
  const { references, removeReference, clearReferences, getContextPrompt, referenceCount } = useChatReferences()
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
  const [includeVisualization, setIncludeVisualization] = useState(false) // Toggle for chart generation

  // Estados para diálogos de confirmación
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null)

  // Estados para feedback dialog
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<ChatMessage | null>(null)

  // Estados para diálogo de cambios sin guardar
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState<'new' | 'load' | null>(null)
  const [conversationToLoad, setConversationToLoad] = useState<string | null>(null)

  // Estado para diálogo de advertencia de tokens
  const [showTokenWarningDialog, setShowTokenWarningDialog] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)

  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch real token budget status from API
  const { data: tokenBudget, isLoading: isTokenBudgetLoading } = useTokenBudget()

  // Memoize usage stats; function reads external store, not component state
  const usageStats = useMemo(() => getUsageStats(venueSlug), [venueSlug])

  // Token warning level for styling
  const tokenWarningLevel = useMemo(() => {
    return getTokenWarningLevel(tokenBudget)
  }, [tokenBudget])

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
    mutationFn: async ({ message, withVisualization, referencesContext }: { message: string; withVisualization: boolean; referencesContext?: string }) => {
      // Debug: verificar estado de autenticación antes de enviar
      devLog('Enviando mensaje al asistente:', message, { venueSlug, includeVisualization: withVisualization, hasReferences: !!referencesContext })
      return await sendChatMessage(message, { venueSlug, includeVisualization: withVisualization, referencesContext })
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
        title: tCommon('error'),
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
        title: tCommon('error'),
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
        title: tCommon('error'),
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
        title: tCommon('error'),
        description: t('chat.errors.saveFailed', { defaultValue: 'Could not save the conversation.' }),
      })
    } finally {
      // Add delay to prevent spam clicking
      setTimeout(() => {
        setIsSaving(false)
      }, 1000)
    }
  }, [toast, isSaving, messages, currentConversationId, lastSavedMessageCount, t, venueSlug])

  // Función que ejecuta la creación de nueva conversación
  const performCreateNewConversation = useCallback(() => {
    setIsCreatingNew(true)

    try {
      createNewConversation(venueSlug)
      setCurrentConversationId(null)
      setSavedConversations(getSavedConversations(venueSlug))
      setLastSavedMessageCount(0)

      const welcomeMessage = {
        id: 'welcome',
        text: t('chat.welcome'),
        isUser: false,
        timestamp: new Date(),
        feedbackGiven: null,
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
        title: tCommon('error'),
        description: t('chat.errors.createConversation'),
      })
    } finally {
      setTimeout(() => {
        setIsCreatingNew(false)
      }, 1000)
    }
  }, [toast, t, venueSlug])

  const handleNewConversation = useCallback(() => {
    if (isCreatingNew) return

    const hasUserMessages = messages.some(msg => msg.isUser)

    if (!hasUserMessages) {
      toast({
        title: t('chat.toast.alreadyNew.title'),
        description: t('chat.toast.alreadyNew.desc'),
      })
      return
    }

    // Si hay cambios sin guardar, mostrar confirmación
    if (canSaveConversation) {
      setPendingAction('new')
      setShowUnsavedChangesDialog(true)
      return
    }

    performCreateNewConversation()
  }, [messages, isCreatingNew, canSaveConversation, t, toast, performCreateNewConversation])

  // Función que ejecuta la carga de conversación
  const performLoadConversation = useCallback(
    (conversationId: string) => {
      if (loadConversation(conversationId, venueSlug)) {
        const history = getConversationHistory(venueSlug)
        const convertedMessages = convertHistoryToMessages(history, t('chat.welcome'))
        setMessages(convertedMessages)
        setCurrentConversationId(conversationId)

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

  const handleLoadConversation = useCallback(
    (conversationId: string) => {
      // Si hay cambios sin guardar y es una conversación diferente, mostrar confirmación
      if (canSaveConversation && conversationId !== currentConversationId) {
        setPendingAction('load')
        setConversationToLoad(conversationId)
        setShowUnsavedChangesDialog(true)
        return
      }

      performLoadConversation(conversationId)
    },
    [canSaveConversation, currentConversationId, performLoadConversation],
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

  // Handlers para el diálogo de cambios sin guardar
  const handleSaveAndProceed = useCallback(async () => {
    await handleSaveConversation()
    setShowUnsavedChangesDialog(false)

    if (pendingAction === 'new') {
      performCreateNewConversation()
    } else if (pendingAction === 'load' && conversationToLoad) {
      performLoadConversation(conversationToLoad)
    }

    setPendingAction(null)
    setConversationToLoad(null)
  }, [handleSaveConversation, pendingAction, conversationToLoad, performCreateNewConversation, performLoadConversation])

  const handleDiscardAndProceed = useCallback(() => {
    setShowUnsavedChangesDialog(false)

    if (pendingAction === 'new') {
      performCreateNewConversation()
    } else if (pendingAction === 'load' && conversationToLoad) {
      performLoadConversation(conversationToLoad)
    }

    setPendingAction(null)
    setConversationToLoad(null)
  }, [pendingAction, conversationToLoad, performCreateNewConversation, performLoadConversation])

  const handleCancelUnsavedChanges = useCallback(() => {
    setShowUnsavedChangesDialog(false)
    setPendingAction(null)
    setConversationToLoad(null)
  }, [])

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

  // Check token warning and show dialog if needed
  const tokenWarning = useMemo(() => shouldWarnBeforeSending(tokenBudget), [tokenBudget])

  // Function to actually send the message (used by both direct send and after warning confirmation)
  const sendMessage = useCallback((message: string) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text: message,
      isUser: true,
      timestamp: new Date(),
      feedbackGiven: null, // Initialize feedback state
    }

    // Add user message to UI and localStorage immediately
    setMessages(prev => [...prev, userMessage])
    addMessageToHistory('user', message, venueSlug)

    // Get references context if there are any references
    const referencesContext = referenceCount > 0 ? getContextPrompt() : undefined

    // Use TanStack Query mutation to send the message
    chatMutation.mutate({ message, withVisualization: includeVisualization, referencesContext }, {
      onSuccess: result => {
        const botMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          text: result.response,
          isUser: false,
          timestamp: new Date(),
          cached: result.cached,
          trainingDataId: result.trainingDataId,
          feedbackGiven: null, // Initialize feedback state
          visualization: result.visualization,
          tokenUsage: result.tokenUsage,
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

        // Invalidate token budget to refresh the count after usage
        queryClient.invalidateQueries({ queryKey: tokenBudgetQueryKey })

        devLog('✅ Message exchange completed and saved to history')
      },
    })
  }, [chatMutation, includeVisualization, queryClient, toast, venueSlug, referenceCount, getContextPrompt])

  // Handle confirmation to send despite token warning
  const handleConfirmSendWithWarning = useCallback(() => {
    if (pendingMessage) {
      sendMessage(pendingMessage)
      setPendingMessage(null)
    }
    setShowTokenWarningDialog(false)
  }, [pendingMessage, sendMessage])

  const onSubmit = async (values: { message: string }) => {
    if (!values.message.trim()) return

    // Check if we should warn the user about token usage
    if (tokenWarning.shouldWarn && (tokenWarning.warningType === 'exhausted' || tokenWarning.warningType === 'overage')) {
      setPendingMessage(values.message)
      setShowTokenWarningDialog(true)
      return
    }

    form.reset()
    sendMessage(values.message)
  }
  // Calcular ancho basado en estado
  const cardWidth = useMemo(() => {
    if (!isExpanded) return 'w-80 sm:w-96'
    if (showSidebar) return 'w-[900px] sm:w-[1000px]'
    return 'w-[700px] sm:w-[800px]'
  }, [isExpanded, showSidebar])

  return (
    <Card
      className={`${cardWidth} ${
        isExpanded ? 'h-[700px]' : 'h-auto'
      } fixed bottom-20 right-20 z-9999 shadow-lg theme-transition bg-white overflow-hidden border border-border isolate mix-blend-normal flex flex-col`}
    >
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 bg-background border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          {/* Toggle Sidebar - only show when expanded */}
          {isExpanded && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSidebar(!showSidebar)}
              aria-label={showSidebar ? t('chat.sidebar.hide') : t('chat.sidebar.show')}
              title={showSidebar ? t('chat.sidebar.hide') : t('chat.sidebar.show')}
            >
              {showSidebar ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
          )}
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            {t('chat.title')}
            {canSaveConversation && (
              <Badge variant="outline" className="text-xs font-normal flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                {t('chat.status.unsaved')}
              </Badge>
            )}
            {!canSaveConversation && currentConversationId && (
              <Badge variant="secondary" className="text-xs font-normal">
                {t('chat.status.saved')}
              </Badge>
            )}
            {/* Token Budget Indicator */}
            {isTokenBudgetLoading ? (
              <span className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
              </span>
            ) : tokenBudget ? (
              <Badge
                variant={tokenWarningLevel === 'normal' ? 'secondary' : 'outline'}
                className={`text-xs font-normal flex items-center gap-1 ${
                  tokenWarningLevel === 'overage'
                    ? 'border-red-500 text-red-600 dark:text-red-400'
                    : tokenWarningLevel === 'danger'
                      ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                      : tokenWarningLevel === 'warning'
                        ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400'
                        : ''
                }`}
                title={tokenBudget.warning || t('chat.tokens.available')}
              >
                {tokenWarningLevel === 'overage' ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                {formatTokenCount(tokenBudget.totalAvailable)} {t('chat.tokens.remaining')}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground font-normal">
                ({usageStats.remainingRequests} {t('chat.queriesRemaining')})
              </span>
            )}
          </CardTitle>
        </div>
        <div className="flex items-center space-x-1">
          {/* Save */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleSaveConversation}
            disabled={!canSaveConversation || isSaving}
            aria-label={t('chat.actions.save_conversation')}
            title={canSaveConversation ? t('chat.actions.save_conversation') : t('chat.actions.already_saved')}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>

          {/* New */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleNewConversation}
            disabled={isCreatingNew}
            aria-label={t('chat.actions.new_conversation')}
            title={t('chat.actions.new_conversation')}
          >
            {isCreatingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>

          {/* Dropdown Menu */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('chat.menu.options')}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={5} className="z-[10000]">
              <DropdownMenuItem onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? (
                  <>
                    <Minimize2 className="h-4 w-4 mr-2" />
                    {t('chat.menu.collapse')}
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-4 w-4 mr-2" />
                    {t('chat.menu.expand')}
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleClearHistory}
                disabled={isClearing || !canClearConversation}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('chat.menu.clearHistory')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Close */}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label={t('chat.actions.close_chat')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Main content area with sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {showSidebar && isExpanded && (
          <aside className="w-[220px] border-r border-border bg-muted/30 flex flex-col shrink-0">
            {/* New conversation button */}
            <div className="p-3 border-b border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={handleNewConversation}
                disabled={isCreatingNew}
              >
                {isCreatingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('chat.sidebar.newChat')}
              </Button>
            </div>

            {/* Conversations list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {savedConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-2">
                  <History className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">{t('chat.saved.emptyTitle')}</p>
                </div>
              ) : (
                savedConversations.map(conversation => (
                  <div
                    key={conversation.id}
                    className={`p-2 rounded-md cursor-pointer transition-colors group ${
                      conversation.id === currentConversationId
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => handleLoadConversation(conversation.id)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{conversation.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{conversation.lastMessage}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
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
          </aside>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* References Panel */}
          {referenceCount > 0 && (
            <div className="border-b border-border bg-muted/30 shrink-0">
              <button
                onClick={() => setShowReferencesPanel(!showReferencesPanel)}
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>
                    {t('chat.references.panelTitle', { defaultValue: 'Referencias AI' })} ({referenceCount})
                  </span>
                </div>
                {showReferencesPanel ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {showReferencesPanel && (
                <div className="px-4 pb-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {references.map(ref => (
                      <Badge
                        key={ref.id}
                        variant="secondary"
                        className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 text-xs cursor-pointer hover:bg-destructive/10 transition-colors group"
                        onClick={() => removeReference(ref.id)}
                      >
                        <span>{ref.label}</span>
                        <X className="h-3 w-3 text-muted-foreground group-hover:text-destructive transition-colors" />
                      </Badge>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearReferences}
                      className="text-xs text-muted-foreground hover:text-destructive h-7"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      {t('chat.references.clearAll', { defaultValue: 'Limpiar todas' })}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div className={`flex-1 p-4 overflow-y-auto bg-background ${!isExpanded ? 'h-72' : ''}`}>
            <div className="space-y-4">
            {messages.map((message, index) => (
              <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg theme-transition ${
                    message.isUser ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground border border-border'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{parseMessageText(message.text, message.isUser)}</p>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString(getIntlLocale(i18n.language), {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {message.tokenUsage && message.tokenUsage.totalTokens > 0 && (
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs opacity-50 cursor-help flex items-center gap-0.5">
                                <Zap className="w-3 h-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {message.tokenUsage.totalTokens.toLocaleString()} tokens
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
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
                        disabled={positiveFeedbackMutation.isPending}
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
                        disabled={negativeFeedbackMutation.isPending}
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {/* Chart visualization or skip message */}
                  {!message.isUser && message.visualization && (
                    isVisualizationSkipped(message.visualization) ? (
                      <div className="mt-2 px-2.5 py-1.5 rounded-md bg-muted/50 border border-border/50 flex items-center gap-2">
                        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          {message.visualization.reason}
                        </span>
                      </div>
                    ) : (
                      <ChatChart visualization={message.visualization} />
                    )
                  )}
                </div>
              </div>
            ))}
              <div ref={setMessagesEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div className="p-4 pt-2 bg-background border-t border-border flex flex-col gap-1.5 shrink-0">
            {/* Visualization toggle */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="viz-toggle"
                  checked={includeVisualization}
                  onCheckedChange={setIncludeVisualization}
                  className="scale-75"
                />
                <label
                  htmlFor="viz-toggle"
                  className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer"
                >
                  <BarChart3 className="h-3 w-3" />
                  {t('chat.visualization.toggle')}
                </label>
              </div>
              {includeVisualization && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  ⚡ {t('chat.visualization.tokenWarning')}
                </span>
              )}
            </div>

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
          </div>
        </div>
      </div>

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

      {/* Unsaved Changes Dialog */}
      <Dialog open={showUnsavedChangesDialog} onOpenChange={setShowUnsavedChangesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('chat.unsavedChanges.title')}</DialogTitle>
            <DialogDescription>{t('chat.unsavedChanges.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCancelUnsavedChanges}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDiscardAndProceed}>
              {t('chat.unsavedChanges.discard')}
            </Button>
            <Button onClick={handleSaveAndProceed} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('chat.unsavedChanges.saveFirst')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token Warning Dialog */}
      <Dialog open={showTokenWarningDialog} onOpenChange={(open) => {
        if (!open) {
          setPendingMessage(null)
        }
        setShowTokenWarningDialog(open)
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('chat.tokenWarning.title')}
            </DialogTitle>
            <DialogDescription>
              {tokenWarning.warningType === 'overage'
                ? t('chat.tokenWarning.overageDesc', { cost: tokenBudget?.overageCost.toFixed(2) || '0.00' })
                : t('chat.tokenWarning.exhaustedDesc')
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              {t('chat.tokenWarning.continueQuestion')}
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPendingMessage(null)
                setShowTokenWarningDialog(false)
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={() => {
                form.reset()
                handleConfirmSendWithWarning()
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {t('chat.tokenWarning.sendAnyway')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const { venueId } = useParams()
  const { t } = useTranslation()
  const { referenceCount } = useChatReferences()

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
        className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 relative"
        aria-label={isOpen ? t('chat.a11y.close') : t('chat.a11y.open')}
      >
        <Sparkles className="h-5 w-5" />
        {referenceCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-medium px-1">
            {referenceCount}
          </span>
        )}
      </Button>
    </div>
  )
}
