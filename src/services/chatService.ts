import api from '@/api'

// Configuración del chat
export const CHAT_CONFIG = {
  MAX_HISTORY_LENGTH: 10, // Máximo 10 mensajes en historial para reducir tokens
  MAX_DAILY_REQUESTS: 50, // Límite diario por usuario
}

// Tipos para el chat
export interface ChatMessage {
  id: string
  text: string
  isUser: boolean
  timestamp: Date
  cached?: boolean
  trainingDataId?: string
  metadata?: {
    confidence?: number
    queryGenerated?: boolean
    queryExecuted?: boolean
    rowsReturned?: number
    executionTime?: number
    dataSourcesUsed?: string[]
    sqlQuery?: string
  }
}

interface ConversationEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  trainingDataId?: string
}

interface DailyUsage {
  date: string
  count: number
}

interface SavedConversation {
  id: string
  title: string
  lastMessage: string
  timestamp: Date
  history: ConversationEntry[]
}

interface ConversationsList {
  conversations: SavedConversation[]
  currentId: string | null
}

interface ChatResponse {
  response: string
  suggestions?: string[]
  cached?: boolean
  trainingDataId?: string
  metadata?: {
    confidence: number
    queryGenerated?: boolean
    queryExecuted?: boolean
    rowsReturned?: number
    executionTime?: number
    dataSourcesUsed: string[]
    sqlQuery?: string
  }
}

// Funciones de utilidad para localStorage
const STORAGE_KEYS = {
  CONVERSATION: 'avoqado_chat_history',
  DAILY_USAGE: 'avoqado_chat_daily_usage',
  CONVERSATIONS_LIST: 'avoqado_chat_conversations',
  CURRENT_CONVERSATION: 'avoqado_current_conversation_id',
  CURRENT_VENUE: 'avoqado_current_venue_slug', // Nuevo: track venue actual
}

// Función para obtener venue actual desde URL o contexto
const getCurrentVenueSlug = (): string | null => {
  // Extraer slug de la URL: /dashboard/{venueSlug}/...
  const pathSegments = window.location.pathname.split('/')
  const venueSlug = pathSegments[2] || null
  return venueSlug && venueSlug !== 'dashboard' ? venueSlug : null
}

// Función para generar keys específicas por venue
const getVenueSpecificKey = (baseKey: string, venueSlug?: string | null): string => {
  const currentVenue = venueSlug || getCurrentVenueSlug()
  return currentVenue ? `${baseKey}_${currentVenue}` : baseKey
}

// Gestión del historial de conversación por venue
export const getConversationHistory = (venueSlug?: string | null): ConversationEntry[] => {
  try {
    const venueSpecificKey = getVenueSpecificKey(STORAGE_KEYS.CONVERSATION, venueSlug)
    const stored = localStorage.getItem(venueSpecificKey)
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }))
    }
  } catch (error) {
    console.warn('Error loading conversation history:', error)
  }
  return []
}

const saveConversationHistory = (history: ConversationEntry[], venueSlug?: string | null) => {
  try {
    // Mantener solo los últimos mensajes para reducir tokens
    const recentHistory = history.slice(-CHAT_CONFIG.MAX_HISTORY_LENGTH)
    const venueSpecificKey = getVenueSpecificKey(STORAGE_KEYS.CONVERSATION, venueSlug)
    localStorage.setItem(venueSpecificKey, JSON.stringify(recentHistory))
    console.log('💾 Chat history saved:', {
      venue: venueSlug || getCurrentVenueSlug(),
      totalEntries: recentHistory.length,
      lastEntry: recentHistory[recentHistory.length - 1],
    })
    return recentHistory
  } catch (error) {
    console.warn('Error saving conversation history:', error)
    return history
  }
}

// Nueva función para agregar mensajes individuales al historial por venue
export const addMessageToHistory = (
  role: 'user' | 'assistant',
  content: string,
  venueSlug?: string | null,
  trainingDataId?: string,
) => {
  try {
    const currentVenue = venueSlug || getCurrentVenueSlug()
    const currentHistory = getConversationHistory(currentVenue)
    const newEntry: ConversationEntry = {
      role,
      content,
      timestamp: new Date(),
    }

    if (role === 'assistant' && trainingDataId) {
      newEntry.trainingDataId = trainingDataId
    }

    const updatedHistory = [...currentHistory, newEntry]
    saveConversationHistory(updatedHistory, currentVenue)

    console.log('➕ Message added to history:', {
      venue: currentVenue,
      role,
      contentPreview: content.substring(0, 50) + '...',
      historyLength: updatedHistory.length,
      hasTrainingId: !!trainingDataId,
    })

    return updatedHistory
  } catch (error) {
    console.error('Error adding message to history:', error)
    return getConversationHistory(venueSlug)
  }
}

// Gestión de uso diario
const getDailyUsage = (): DailyUsage => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DAILY_USAGE)
    if (stored) {
      const usage = JSON.parse(stored) as DailyUsage
      const today = new Date().toDateString()
      
      if (usage.date === today) {
        return usage
      }
    }
  } catch (error) {
    console.warn('Error loading daily usage:', error)
  }
  
  return { date: new Date().toDateString(), count: 0 }
}

const incrementDailyUsage = () => {
  const usage = getDailyUsage()
  usage.count++
  localStorage.setItem(STORAGE_KEYS.DAILY_USAGE, JSON.stringify(usage))
  return usage
}

const checkDailyLimit = (): boolean => {
  const usage = getDailyUsage()
  return usage.count < CHAT_CONFIG.MAX_DAILY_REQUESTS
}

// Sugerencias predefinidas para consultas comunes
const PREDEFINED_SUGGESTIONS = [
  '¿Cuáles fueron las ventas de hoy?',
  '¿Qué mesero generó más propinas esta semana?',
  '¿Cuáles son los productos más vendidos del mes?',
  '¿Hay alguna alerta que deba revisar?',
  '¿Cómo van las calificaciones de clientes?',
  'Muéstrame el resumen del día de ayer',
  '¿Qué productos tienen stock bajo?',
  '¿Cómo puedo mejorar las ventas de productos lentos?',
]

// Función para detectar y manejar cambios de venue
const handleVenueChange = (): { venueChanged: boolean; previousVenue: string | null; currentVenue: string | null } => {
  const currentVenue = getCurrentVenueSlug()
  const storedVenue = localStorage.getItem(STORAGE_KEYS.CURRENT_VENUE)
  
  if (storedVenue !== currentVenue) {
    // Venue cambió
    localStorage.setItem(STORAGE_KEYS.CURRENT_VENUE, currentVenue || '')
    
    console.log('🏢 Venue change detected:', {
      from: storedVenue,
      to: currentVenue
    })
    
    return {
      venueChanged: true,
      previousVenue: storedVenue,
      currentVenue
    }
  }
  
  return {
    venueChanged: false,
    previousVenue: storedVenue,
    currentVenue
  }
}

// Función para generar mensaje de contexto cuando cambia el venue
const generateVenueChangeContext = (previousVenue: string | null, currentVenue: string | null): string => {
  if (!previousVenue && currentVenue) {
    return `[CONTEXTO: Usuario accedió al dashboard del venue '${currentVenue}'. Todas las consultas deben ser para este venue específicamente.]`
  }
  
  if (previousVenue && currentVenue && previousVenue !== currentVenue) {
    return `[CONTEXTO: Usuario cambió del venue '${previousVenue}' al venue '${currentVenue}'. Nueva conversación iniciada. Todas las consultas ahora son para el venue '${currentVenue}' exclusivamente.]`
  }
  
  return ''
}

// Función principal para enviar mensajes usando API directamente
export const sendChatMessage = async (message: string): Promise<ChatResponse> => {
  // Validaciones
  if (!message.trim()) {
    throw new Error('El mensaje no puede estar vacío')
  }
  
  if (message.length > 2000) {
    throw new Error('El mensaje es demasiado largo (máximo 2000 caracteres)')
  }
  
  // Verificar límite diario
  if (!checkDailyLimit()) {
    throw new Error(`Has alcanzado el límite diario de ${CHAT_CONFIG.MAX_DAILY_REQUESTS} consultas. Intenta mañana.`)
  }
  
  try {
    // Detectar cambios de venue
    const { venueChanged, previousVenue, currentVenue } = handleVenueChange()
    
    // Preparar historial de conversación para el venue actual
    let history = getConversationHistory(currentVenue)
    
    // Si cambio de venue, agregar contexto e iniciar nueva conversación
    if (venueChanged) {
      const contextMessage = generateVenueChangeContext(previousVenue, currentVenue)
      if (contextMessage) {
        // Añadir mensaje de contexto al historial
        const contextEntry: ConversationEntry = {
          role: 'assistant',
          content: contextMessage,
          timestamp: new Date()
        }
        history = [contextEntry]
        console.log('🔄 Venue change context added to conversation')
      }
    }
    
    // Llamar a la API Text-to-SQL usando axios (que ya tiene la configuración correcta)
    const response = await api.post('/api/v1/dashboard/assistant/text-to-sql', {
      message,
      conversationHistory: history,
    })
    
    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Error en la respuesta del servidor')
    }
    
    const result = response.data.data
    const aiResponse = result.response || 'No se pudo obtener una respuesta.'
    const suggestions = result.suggestions || []
    const metadata = result.metadata || {}
    
    // Debug: Log the complete backend response
    console.log('🔍 Backend response data:', result)
    console.log('🔍 TrainingDataId from backend:', result.trainingDataId)
    
    // NOTA: El historial ahora se maneja desde ChatBubble.tsx para evitar duplicados
    // Pero aseguramos que se guarde en el venue correcto
    // const newHistory = [
    //   ...history,
    //   { role: 'user' as const, content: message, timestamp: new Date() },
    //   { role: 'assistant' as const, content: aiResponse, timestamp: new Date() }
    // ]
    // saveConversationHistory(newHistory, currentVenue)
    
    // Incrementar contador de uso
    incrementDailyUsage()
    
    // Log Text-to-SQL metadata for debugging
    console.log('🔍 Text-to-SQL Assistant Response:', {
      confidence: metadata.confidence,
      queryGenerated: metadata.queryGenerated,
      queryExecuted: metadata.queryExecuted,
      rowsReturned: metadata.rowsReturned,
      executionTime: metadata.executionTime,
      dataSourcesUsed: metadata.dataSourcesUsed,
      sqlQuery: metadata.sqlQuery, // Only in development
    })
    
    return {
      response: aiResponse,
      suggestions,
      cached: false,
      metadata,
      trainingDataId: result.trainingDataId,
    }
    
  } catch (error: any) {
    console.error('Error sending chat message:', error)
    
    // Manejo específico de errores
    if (error.response?.status === 401) {
      throw new Error('No estás autenticado. Por favor, recarga la página e inicia sesión nuevamente.')
    } else if (error.response?.status === 403) {
      throw new Error('No tienes permisos para usar el asistente IA.')
    } else if (error.response?.status >= 500) {
      throw new Error('Error del servidor. Por favor, intenta más tarde.')
    } else if (error instanceof Error) {
      throw new Error(error.message)
    } else {
      throw new Error('Error desconocido al enviar el mensaje')
    }
  }
}

// Función para obtener sugerencias
export const getSuggestions = async (): Promise<string[]> => {
  try {
    const response = await api.get('/api/v1/dashboard/assistant/suggestions')
    return response.data?.data?.suggestions || PREDEFINED_SUGGESTIONS
  } catch (error) {
    console.warn('Error fetching suggestions, using predefined ones:', error)
    return PREDEFINED_SUGGESTIONS
  }
}

// Función para limpiar el historial (venue-specific o global)
export const clearConversationHistory = (venueSlug?: string | null) => {
  if (venueSlug) {
    // Limpiar historial de venue específico
    const venueSpecificKey = getVenueSpecificKey(STORAGE_KEYS.CONVERSATION, venueSlug)
    localStorage.removeItem(venueSpecificKey)
    console.log(`Historial de conversación limpiado para venue: ${venueSlug}`)
  } else {
    // Limpiar historial del venue actual
    const currentVenue = getCurrentVenueSlug()
    const venueSpecificKey = getVenueSpecificKey(STORAGE_KEYS.CONVERSATION, currentVenue)
    localStorage.removeItem(venueSpecificKey)
    console.log(`Historial de conversación limpiado para venue actual: ${currentVenue}`)
  }
}

// Función para obtener estadísticas de uso
export const getUsageStats = (venueSlug?: string | null) => {
  const dailyUsage = getDailyUsage()
  const currentVenue = venueSlug || getCurrentVenueSlug()
  const historyLength = getConversationHistory(currentVenue).length
  
  return {
    dailyRequests: dailyUsage.count,
    maxDailyRequests: CHAT_CONFIG.MAX_DAILY_REQUESTS,
    remainingRequests: Math.max(0, CHAT_CONFIG.MAX_DAILY_REQUESTS - dailyUsage.count),
    conversationLength: historyLength,
    currentVenue,
  }
}

// Función para debugging
export const debugInfo = () => {
  const currentVenue = getCurrentVenueSlug()
  console.log('=== Chat Service Debug Info ===')
  console.log('Current Venue:', currentVenue)
  console.log('Usage Stats:', getUsageStats(currentVenue))
  console.log('Conversation History:', getConversationHistory(currentVenue))
  console.log('===============================')
}

// Legacy functions para compatibilidad (si son necesarias)
export const initializeChatSession = async (userId: string, venueId: string): Promise<string> => {
  return `session-${userId}-${venueId}-${Date.now()}`
}

export const clearChatHistory = async (venueId?: string): Promise<boolean> => {
  clearConversationHistory()
  return true
}

// === GESTIÓN DE CONVERSACIONES MÚLTIPLES ===

// Obtener lista de conversaciones guardadas
export const getSavedConversations = (): SavedConversation[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS_LIST)
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed.map((conv: any) => ({
        ...conv,
        timestamp: new Date(conv.timestamp),
        history: conv.history.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        })),
      }))
    }
  } catch (error) {
    console.warn('Error loading saved conversations:', error)
  }
  return []
}

// Guardar una conversación para venue específico
export const saveConversation = (title?: string, venueSlug?: string | null): string => {
  const currentVenue = venueSlug || getCurrentVenueSlug()
  const currentHistory = getConversationHistory(currentVenue)
  if (currentHistory.length === 0) return ''

  const conversations = getSavedConversations()
  const conversationId = `conv_${currentVenue}_${Date.now()}`
  
  // Generar título automático si no se proporciona
  const autoTitle = title || generateConversationTitle(currentHistory)
  const lastMessage = currentHistory[currentHistory.length - 1]?.content || ''

  const newConversation: SavedConversation = {
    id: conversationId,
    title: `[${currentVenue}] ${autoTitle}`,
    lastMessage: lastMessage.substring(0, 100) + (lastMessage.length > 100 ? '...' : ''),
    timestamp: new Date(),
    history: [...currentHistory],
  }

  const updatedConversations = [newConversation, ...conversations].slice(0, 10) // Mantener solo las 10 más recientes
  
  try {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS_LIST, JSON.stringify(updatedConversations))
    console.log(`💾 Conversación guardada para ${currentVenue}: ${autoTitle}`)
  } catch (error) {
    console.error('Error saving conversation:', error)
  }

  return conversationId
}

// Cargar una conversación específica
export const loadConversation = (conversationId: string): boolean => {
  const conversations = getSavedConversations()
  const conversation = conversations.find(conv => conv.id === conversationId)
  
  if (conversation) {
    try {
      localStorage.setItem(STORAGE_KEYS.CONVERSATION, JSON.stringify(conversation.history))
      localStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION, conversationId)
      console.log(`📖 Conversación cargada: ${conversation.title}`)
      return true
    } catch (error) {
      console.error('Error loading conversation:', error)
    }
  }
  
  return false
}

// Eliminar una conversación guardada
export const deleteConversation = (conversationId: string): boolean => {
  try {
    const conversations = getSavedConversations()
    const updatedConversations = conversations.filter(conv => conv.id !== conversationId)
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS_LIST, JSON.stringify(updatedConversations))
    
    // Si es la conversación actual, limpiar
    const currentId = localStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION)
    if (currentId === conversationId) {
      clearConversationHistory()
      localStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION)
    }
    
    console.log(`🗑️ Conversación eliminada: ${conversationId}`)
    return true
  } catch (error) {
    console.error('Error deleting conversation:', error)
    return false
  }
}

// Generar título automático basado en el primer mensaje del usuario
const generateConversationTitle = (history: ConversationEntry[]): string => {
  const firstUserMessage = history.find(entry => entry.role === 'user')
  if (firstUserMessage) {
    const title = firstUserMessage.content.substring(0, 50)
    return title.length < firstUserMessage.content.length ? title + '...' : title
  }
  return `Conversación del ${new Date().toLocaleDateString()}`
}

// Crear nueva conversación (limpiar la actual) para venue específico
export const createNewConversation = (venueSlug?: string | null): void => {
  const currentVenue = venueSlug || getCurrentVenueSlug()
  
  // Guardar automáticamente la conversación actual si tiene contenido
  const currentHistory = getConversationHistory(currentVenue)
  if (currentHistory.length > 1) { // Más de solo el mensaje de bienvenida
    saveConversation(undefined, currentVenue)
  }
  
  // Limpiar la conversación actual
  clearConversationHistory(currentVenue)
  localStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION)
  console.log(`✨ Nueva conversación creada para venue: ${currentVenue}`)
}

// Obtener ID de la conversación actual
export const getCurrentConversationId = (): string | null => {
  return localStorage.getItem('currentConversationId')
}

// Submit feedback for AI assistant responses
export const submitFeedback = async (
  trainingDataId: string,
  feedbackType: 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT',
  correctedResponse?: string,
  correctedSql?: string,
  userNotes?: string
) => {
  try {
    const response = await api.post('/api/v1/dashboard/assistant/feedback', {
      trainingDataId,
      feedbackType,
      correctedResponse,
      correctedSql,
      userNotes,
    })

    return response.data
  } catch (error) {
    console.error('Error submitting feedback:', error)
    throw error
  }
}

// Submit negative feedback and get corrected response
export const submitFeedbackWithCorrection = async (
  trainingDataId: string,
  problemDescription: string,
  originalQuestion: string
): Promise<{
  success: boolean
  correctedResponse?: string
  trainingDataId?: string
}> => {
  try {
    // First submit the feedback
    await submitFeedback(trainingDataId, 'INCORRECT', undefined, undefined, problemDescription)
    
    // Then request a corrected response based on the feedback
    const response = await api.post('/api/v1/dashboard/assistant/text-to-sql', {
      message: `${originalQuestion}\n\nFeedback del usuario: ${problemDescription}`,
      conversationHistory: getConversationHistory(),
    })

    return {
      success: true,
      correctedResponse: response.data.data.response,
      trainingDataId: response.data.data.trainingDataId,
    }
  } catch (error) {
    console.error('Error submitting feedback with correction:', error)
    throw error
  }
}

// === FUNCIONES PARA MANEJO DE VENUE-SPECIFIC CHAT ===

// Inicializar contexto de venue (llamar al cargar la app)
export const initializeVenueContext = (): void => {
  const currentVenue = getCurrentVenueSlug()
  const storedVenue = localStorage.getItem(STORAGE_KEYS.CURRENT_VENUE)
  
  if (currentVenue && currentVenue !== storedVenue) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_VENUE, currentVenue)
    console.log('🏢 Venue context initialized:', currentVenue)
  }
}

// Obtener resumen del estado actual del chat
export const getChatStatus = () => {
  const currentVenue = getCurrentVenueSlug()
  const history = getConversationHistory(currentVenue)
  const stats = getUsageStats(currentVenue)
  
  return {
    currentVenue,
    hasHistory: history.length > 0,
    messageCount: history.length,
    ...stats
  }
}

// Función para notificar cambio de venue (usar desde componentes)
export const notifyVenueChange = (newVenueSlug: string): void => {
  const previousVenue = getCurrentVenueSlug()
  
  // Actualizar venue actual en localStorage
  localStorage.setItem(STORAGE_KEYS.CURRENT_VENUE, newVenueSlug)
  
  console.log('🔄 Venue change notified:', {
    from: previousVenue,
    to: newVenueSlug
  })
  
  // El próximo mensaje del chat detectará el cambio automáticamente
}