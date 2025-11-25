import api from '@/api'

// Configuración del chat
export const CHAT_CONFIG = {
  MAX_HISTORY_LENGTH: 10, // Máximo 10 mensajes en historial para reducir tokens
  MAX_DAILY_REQUESTS: 50, // Límite diario por usuario
}

const isDevEnvironment = import.meta.env.DEV

const devLog = (...args: unknown[]) => {
  if (isDevEnvironment) {
    console.log(...args)
  }
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

// interface ConversationsList {
//   conversations: SavedConversation[]
//   currentId: string | null
// }

// Chart visualization data returned from backend
export interface ChartVisualization {
  type: 'bar' | 'line' | 'pie' | 'area'
  title: string
  description?: string
  data: Array<Record<string, any>>
  config: {
    xAxis?: { key: string; label: string }
    yAxis?: { key: string; label: string }
    dataKeys: Array<{ key: string; label: string; color?: string }>
  }
}

// When visualization was requested but couldn't be generated
export interface VisualizationSkipped {
  skipped: true
  reason: string
}

// Union type: either a chart or a skip reason
export type VisualizationResult = ChartVisualization | VisualizationSkipped

// Type guard to check if visualization was skipped
export const isVisualizationSkipped = (viz: VisualizationResult | undefined): viz is VisualizationSkipped => {
  return viz !== undefined && 'skipped' in viz && viz.skipped === true
}

interface ChatResponse {
  response: string
  suggestions?: string[]
  cached?: boolean
  trainingDataId?: string
  visualization?: VisualizationResult
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
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

const CHAT_STORAGE_PREFIXES = Object.values(STORAGE_KEYS)

// Función para obtener venue actual desde URL o contexto
const getCurrentVenueSlug = (): string | null => {
  // Extraer slug de la URL: /dashboard/{venueSlug}/...
  const pathSegments = window.location.pathname.split('/')
  const venueSlug = pathSegments[2] || null
  return venueSlug && venueSlug !== 'dashboard' ? venueSlug : null
}

// Función para obtener usuario actual
const getCurrentUserId = (): string | null => {
  // Try to get user from localStorage auth data
  try {
    const authToken = localStorage.getItem('authToken')
    if (authToken) {
      // Parse JWT to get user ID (basic decode, just for user identification)
      const payload = JSON.parse(atob(authToken.split('.')[1]))
      return payload.userId || payload.sub || null
    }
  } catch (error) {
    console.warn('Could not extract user ID from token:', error)
  }

  // Fallback: try to get from any auth context in localStorage
  try {
    const authData = localStorage.getItem('authData') || localStorage.getItem('user')
    if (authData) {
      const parsed = JSON.parse(authData)
      return parsed.id || parsed.userId || null
    }
  } catch (error) {
    console.warn('Could not get user from localStorage:', error)
  }

  return null
}

// Función para generar keys específicas por venue y usuario
const getUserVenueSpecificKey = (baseKey: string, venueSlug?: string | null, userId?: string | null): string => {
  const currentVenue = venueSlug || getCurrentVenueSlug()
  const currentUserId = userId || getCurrentUserId()

  let key = baseKey

  if (currentVenue) {
    key = `${key}_${currentVenue}`
  }

  if (currentUserId) {
    key = `${key}_user_${currentUserId}`
  }

  return key
}

// Legacy function for backward compatibility
const getVenueSpecificKey = (baseKey: string, venueSlug?: string | null): string => {
  return getUserVenueSpecificKey(baseKey, venueSlug)
}

// Gestión del historial de conversación por venue y usuario
export const getConversationHistory = (venueSlug?: string | null, userId?: string | null): ConversationEntry[] => {
  try {
    const currentVenue = venueSlug ?? getCurrentVenueSlug()
    const currentUserId = userId ?? getCurrentUserId()
    const userSpecificKey = getUserVenueSpecificKey(STORAGE_KEYS.CONVERSATION, currentVenue, currentUserId)
    const legacyKey = getVenueSpecificKey(STORAGE_KEYS.CONVERSATION, currentVenue)

    let stored = localStorage.getItem(userSpecificKey)
    let readKey = userSpecificKey

    if (!stored) {
      stored = localStorage.getItem(legacyKey)
      readKey = legacyKey
    }

    if (stored) {
      const parsed = JSON.parse(stored)
      const history = parsed.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }))

      // Si leímos del key legacy, migramos al nuevo namespace
      if (readKey === legacyKey) {
        saveConversationHistory(history, currentVenue, currentUserId)
      }

      return history
    }
  } catch (error) {
    console.warn('Error loading conversation history:', error)
  }
  return []
}

const saveConversationHistory = (history: ConversationEntry[], venueSlug?: string | null, userId?: string | null) => {
  try {
    // Mantener solo los últimos mensajes para reducir tokens
    const recentHistory = history.slice(-CHAT_CONFIG.MAX_HISTORY_LENGTH)
    const currentVenue = venueSlug ?? getCurrentVenueSlug()
    const currentUserId = userId ?? getCurrentUserId()
    const userSpecificKey = getUserVenueSpecificKey(STORAGE_KEYS.CONVERSATION, currentVenue, currentUserId)
    const legacyKey = getVenueSpecificKey(STORAGE_KEYS.CONVERSATION, currentVenue)

    localStorage.setItem(userSpecificKey, JSON.stringify(recentHistory))

    // Limpiar datos legacy para evitar fuga entre usuarios
    if (legacyKey !== userSpecificKey) {
      localStorage.removeItem(legacyKey)
    }

    devLog('💾 Chat history saved:', {
      venue: currentVenue,
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
  userId?: string | null,
) => {
  try {
    const currentVenue = venueSlug || getCurrentVenueSlug()
    const currentUserId = userId ?? getCurrentUserId()
    const currentHistory = getConversationHistory(currentVenue, currentUserId)
    const newEntry: ConversationEntry = {
      role,
      content,
      timestamp: new Date(),
    }

    if (role === 'assistant' && trainingDataId) {
      newEntry.trainingDataId = trainingDataId
    }

    const updatedHistory = [...currentHistory, newEntry]
    saveConversationHistory(updatedHistory, currentVenue, currentUserId)

    devLog('➕ Message added to history:', {
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
const getDailyUsage = (userId?: string | null): DailyUsage => {
  try {
    const usageKey = getUserVenueSpecificKey(STORAGE_KEYS.DAILY_USAGE, null, userId ?? getCurrentUserId())
    const legacyKey = STORAGE_KEYS.DAILY_USAGE

    let stored = localStorage.getItem(usageKey)
    if (!stored) {
      stored = localStorage.getItem(legacyKey)
    }

    if (stored) {
      const usage = JSON.parse(stored) as DailyUsage
      const today = new Date().toDateString()

      if (usage.date === today) {
        if (!localStorage.getItem(usageKey)) {
          localStorage.setItem(usageKey, stored)
        }
        return usage
      }
    }
  } catch (error) {
    console.warn('Error loading daily usage:', error)
  }

  return { date: new Date().toDateString(), count: 0 }
}

const incrementDailyUsage = (userId?: string | null) => {
  const currentUserId = userId ?? getCurrentUserId()
  const usage = getDailyUsage(currentUserId)
  usage.count++
  const usageKey = getUserVenueSpecificKey(STORAGE_KEYS.DAILY_USAGE, null, currentUserId)
  localStorage.setItem(usageKey, JSON.stringify(usage))
  return usage
}

const checkDailyLimit = (userId?: string | null): boolean => {
  const usage = getDailyUsage(userId)
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
const handleVenueChange = (
  explicitVenue?: string | null,
): { venueChanged: boolean; previousVenue: string | null; currentVenue: string | null } => {
  const currentVenue = explicitVenue ?? getCurrentVenueSlug()
  const storedVenue = localStorage.getItem(STORAGE_KEYS.CURRENT_VENUE)

  if (storedVenue !== currentVenue) {
    // Venue cambió
    localStorage.setItem(STORAGE_KEYS.CURRENT_VENUE, currentVenue || '')

    devLog('🏢 Venue change detected:', {
      from: storedVenue,
      to: currentVenue,
    })

    return {
      venueChanged: true,
      previousVenue: storedVenue,
      currentVenue: currentVenue || null,
    }
  }

  return {
    venueChanged: false,
    previousVenue: storedVenue,
    currentVenue,
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

interface SendChatMessageOptions {
  venueSlug?: string | null
  userId?: string | null
  includeVisualization?: boolean
}

// Función principal para enviar mensajes usando API directamente
export const sendChatMessage = async (message: string, options?: SendChatMessageOptions): Promise<ChatResponse> => {
  // Validaciones
  if (!message.trim()) {
    throw new Error('El mensaje no puede estar vacío')
  }

  if (message.length > 2000) {
    throw new Error('El mensaje es demasiado largo (máximo 2000 caracteres)')
  }

  const targetVenue = options?.venueSlug ?? getCurrentVenueSlug()
  const targetUserId = options?.userId ?? getCurrentUserId()

  // Verificar límite diario
  if (!checkDailyLimit(targetUserId)) {
    throw new Error(`Has alcanzado el límite diario de ${CHAT_CONFIG.MAX_DAILY_REQUESTS} consultas. Intenta mañana.`)
  }

  try {
    // Detectar cambios de venue
    const { venueChanged, previousVenue, currentVenue } = handleVenueChange(targetVenue)

    // Preparar historial de conversación para el venue actual
    let history = getConversationHistory(currentVenue, targetUserId)

    // Si cambio de venue, agregar contexto e iniciar nueva conversación
    if (venueChanged) {
      const contextMessage = generateVenueChangeContext(previousVenue, currentVenue)
      if (contextMessage) {
        // Añadir mensaje de contexto al historial
        const contextEntry: ConversationEntry = {
          role: 'assistant',
          content: contextMessage,
          timestamp: new Date(),
        }
        history = [contextEntry]
        devLog('🔄 Venue change context added to conversation')
      }
    }

    // Llamar a la API Text-to-SQL usando axios (que ya tiene la configuración correcta)
    const serializedHistory = history.map(entry => ({
      ...entry,
      timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp,
    }))

    const payload: Record<string, unknown> = {
      message,
      conversationHistory: serializedHistory,
    }

    if (currentVenue) {
      payload.venueSlug = currentVenue
    }
    if (targetUserId) {
      payload.userId = targetUserId
    }
    if (options?.includeVisualization) {
      payload.includeVisualization = true
    }

    const response = await api.post('/api/v1/dashboard/assistant/text-to-sql', payload)

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Error en la respuesta del servidor')
    }

    const result = response.data.data
    const aiResponse = result.response || 'No se pudo obtener una respuesta.'
    const suggestions = result.suggestions || []
    const metadata = result.metadata || {}

    // Debug: Log the complete backend response solo en desarrollo
    devLog('🔍 Backend response data:', result)
    devLog('🔍 TrainingDataId from backend:', result.trainingDataId)

    // NOTA: El historial ahora se maneja desde ChatBubble.tsx para evitar duplicados
    // Pero aseguramos que se guarde en el venue correcto
    // const newHistory = [
    //   ...history,
    //   { role: 'user' as const, content: message, timestamp: new Date() },
    //   { role: 'assistant' as const, content: aiResponse, timestamp: new Date() }
    // ]
    // saveConversationHistory(newHistory, currentVenue)

    // Incrementar contador de uso
    incrementDailyUsage(targetUserId)

    // Sanitizar metadata para evitar exponer consultas sensibles
    const safeMetadata = metadata ? { ...metadata } : undefined
    if (safeMetadata && 'sqlQuery' in safeMetadata) {
      delete safeMetadata.sqlQuery
    }

    // Log Text-to-SQL metadata para depurar únicamente en desarrollo
    devLog('🔍 Text-to-SQL Assistant Response:', {
      confidence: metadata.confidence,
      queryGenerated: metadata.queryGenerated,
      queryExecuted: metadata.queryExecuted,
      rowsReturned: metadata.rowsReturned,
      executionTime: metadata.executionTime,
      dataSourcesUsed: metadata.dataSourcesUsed,
    })

    return {
      response: aiResponse,
      suggestions,
      cached: false,
      metadata: safeMetadata,
      trainingDataId: result.trainingDataId,
      visualization: result.visualization,
      tokenUsage: result.tokenUsage,
    }
  } catch (error: any) {
    console.error('Error sending chat message:', error)

    // Manejo específico de errores
    if (error.response?.status === 401) {
      throw new Error('No estás autenticado. Por favor, recarga la página e inicia sesión nuevamente.')
    } else if (error.response?.status === 403) {
      const backendMessage = error.response?.data?.message
      const friendlyMessage = backendMessage || 'No tienes permisos para usar el asistente IA.'
      throw new Error(friendlyMessage)
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
export const clearConversationHistory = (venueSlug?: string | null, userId?: string | null) => {
  const currentVenue = venueSlug ?? getCurrentVenueSlug()
  const currentUserId = userId ?? getCurrentUserId()

  const userSpecificKey = getUserVenueSpecificKey(STORAGE_KEYS.CONVERSATION, currentVenue, currentUserId)
  const legacyKey = getVenueSpecificKey(STORAGE_KEYS.CONVERSATION, currentVenue)

  localStorage.removeItem(userSpecificKey)
  localStorage.removeItem(legacyKey)

  devLog(`Historial de conversación limpiado para venue: ${currentVenue}`)
}

// Función para obtener estadísticas de uso
export const getUsageStats = (venueSlug?: string | null, userId?: string | null) => {
  const currentUserId = userId ?? getCurrentUserId()
  const dailyUsage = getDailyUsage(currentUserId)
  const currentVenue = venueSlug || getCurrentVenueSlug()
  const historyLength = getConversationHistory(currentVenue, currentUserId).length

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
  if (!isDevEnvironment) return

  const currentVenue = getCurrentVenueSlug()
  const currentUserId = getCurrentUserId()
  devLog('=== Chat Service Debug Info ===')
  devLog('Current Venue:', currentVenue)
  devLog('Usage Stats:', getUsageStats(currentVenue, currentUserId))
  devLog('Conversation History:', getConversationHistory(currentVenue, currentUserId))
  devLog('===============================')
}

// Legacy functions para compatibilidad (si son necesarias)
export const initializeChatSession = async (userId: string, venueId: string): Promise<string> => {
  return `session-${userId}-${venueId}-${Date.now()}`
}

export const clearChatHistory = async (): Promise<boolean> => {
  clearConversationHistory()
  return true
}

// === GESTIÓN DE CONVERSACIONES MÚLTIPLES ===

// Obtener lista de conversaciones guardadas
export const getSavedConversations = (venueSlug?: string | null, userId?: string | null): SavedConversation[] => {
  try {
    const currentVenue = venueSlug ?? getCurrentVenueSlug()
    const currentUserId = userId ?? getCurrentUserId()
    const userSpecificKey = getUserVenueSpecificKey(STORAGE_KEYS.CONVERSATIONS_LIST, currentVenue, currentUserId)
    const legacyKey = getVenueSpecificKey(STORAGE_KEYS.CONVERSATIONS_LIST, currentVenue)

    let stored = localStorage.getItem(userSpecificKey)
    let readKey = userSpecificKey

    if (!stored) {
      stored = localStorage.getItem(legacyKey)
      readKey = legacyKey
    }

    if (stored) {
      const parsed = JSON.parse(stored)
      const conversations = parsed.map((conv: any) => ({
        ...conv,
        timestamp: new Date(conv.timestamp),
        history: conv.history.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        })),
      }))

      if (readKey === legacyKey) {
        localStorage.setItem(userSpecificKey, JSON.stringify(parsed))
        localStorage.removeItem(legacyKey)
      }

      return conversations
    }
  } catch (error) {
    console.warn('Error loading saved conversations:', error)
  }
  return []
}

// Guardar una conversación para venue específico
export const saveConversation = async (
  title?: string,
  venueSlug?: string | null,
  existingConversationId?: string | null,
  userId?: string | null,
): Promise<string> => {
  const currentVenue = venueSlug || getCurrentVenueSlug()
  const currentUserId = userId ?? getCurrentUserId()
  const currentHistory = getConversationHistory(currentVenue, currentUserId)
  if (currentHistory.length === 0) return ''

  const conversations = getSavedConversations(currentVenue, currentUserId)
  let conversationId = existingConversationId
  let isUpdate = false

  // If we have an existing conversation ID, try to find and update it
  if (conversationId) {
    const existingConversationIndex = conversations.findIndex(conv => conv.id === conversationId)
    if (existingConversationIndex !== -1) {
      isUpdate = true
    }
  }

  // If no existing conversation or not found, create new ID
  if (!conversationId || !isUpdate) {
    conversationId = `conv_${currentVenue}_${Date.now()}`
  }

  // Generate title using LLM if not provided, fallback to simple title generation
  let autoTitle: string
  try {
    autoTitle = title || (await generateConversationTitleWithLLM(currentHistory))
  } catch (error) {
    console.warn('LLM title generation failed, using fallback:', error)
    autoTitle = title || generateConversationTitleFallback(currentHistory)
  }
  const lastMessage = currentHistory[currentHistory.length - 1]?.content || ''

  const conversationData: SavedConversation = {
    id: conversationId,
    title: `[${currentVenue}] ${autoTitle}`,
    lastMessage: lastMessage.substring(0, 100) + (lastMessage.length > 100 ? '...' : ''),
    timestamp: new Date(),
    history: [...currentHistory],
  }

  let updatedConversations: SavedConversation[]

  if (isUpdate) {
    // Update existing conversation
    updatedConversations = conversations.map(conv => (conv.id === conversationId ? conversationData : conv))
    devLog(`🔄 Conversación actualizada para ${currentVenue}: ${autoTitle}`, {
      conversationId,
      oldTitle: conversations.find(c => c.id === conversationId)?.title,
      newTitle: conversationData.title,
      messageCount: currentHistory.length,
    })
  } else {
    // Add new conversation at the beginning
    updatedConversations = [conversationData, ...conversations].slice(0, 10)
    devLog(`💾 Nueva conversación guardada para ${currentVenue}: ${autoTitle}`, {
      conversationId,
      title: conversationData.title,
      messageCount: currentHistory.length,
    })
  }

  try {
    const conversationsKey = getUserVenueSpecificKey(STORAGE_KEYS.CONVERSATIONS_LIST, currentVenue, currentUserId)
    localStorage.setItem(conversationsKey, JSON.stringify(updatedConversations))
  } catch (error) {
    console.error('Error saving conversation:', error)
  }

  return conversationId
}

// Cargar una conversación específica
export const loadConversation = (conversationId: string, venueSlug?: string | null, userId?: string | null): boolean => {
  const currentVenue = venueSlug ?? getCurrentVenueSlug()
  const currentUserId = userId ?? getCurrentUserId()
  const conversations = getSavedConversations(currentVenue, currentUserId)
  const conversation = conversations.find(conv => conv.id === conversationId)

  if (conversation) {
    try {
      const historyKey = getUserVenueSpecificKey(STORAGE_KEYS.CONVERSATION, currentVenue, currentUserId)
      localStorage.setItem(historyKey, JSON.stringify(conversation.history))

      const currentConversationKey = getUserVenueSpecificKey(STORAGE_KEYS.CURRENT_CONVERSATION, currentVenue, currentUserId)
      localStorage.setItem(currentConversationKey, conversationId)

      devLog(`📖 Conversación cargada: ${conversation.title}`)
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
    const currentVenue = getCurrentVenueSlug()
    const currentUserId = getCurrentUserId()
    const conversations = getSavedConversations(currentVenue, currentUserId)
    const updatedConversations = conversations.filter(conv => conv.id !== conversationId)
    const conversationsKey = getUserVenueSpecificKey(STORAGE_KEYS.CONVERSATIONS_LIST, currentVenue, currentUserId)
    localStorage.setItem(conversationsKey, JSON.stringify(updatedConversations))

    // Si es la conversación actual, limpiar
    const currentConversationKey = getUserVenueSpecificKey(STORAGE_KEYS.CURRENT_CONVERSATION, currentVenue, currentUserId)
    const currentId = localStorage.getItem(currentConversationKey)
    if (currentId === conversationId) {
      clearConversationHistory(currentVenue, currentUserId)
      localStorage.removeItem(currentConversationKey)
    }

    devLog(`🗑️ Conversación eliminada: ${conversationId}`)
    return true
  } catch (error) {
    console.error('Error deleting conversation:', error)
    return false
  }
}

// Generar título automático basado en el primer mensaje del usuario
// Generate conversation title using LLM
const generateConversationTitleWithLLM = async (history: ConversationEntry[]): Promise<string> => {
  try {
    // Extract user messages and AI responses for context
    const conversationSummary = history
      .slice(0, 10) // Only use first 10 messages to avoid token limits
      .map(entry => `${entry.role === 'user' ? 'Usuario' : 'Asistente'}: ${entry.content}`)
      .join('\n')

    devLog('🤖 Attempting LLM title generation:', {
      url: '/api/v1/dashboard/assistant/generate-title',
      summaryLength: conversationSummary.length,
      hasAuthToken: !!localStorage.getItem('authToken'),
    })

    const response = await fetch('/api/v1/dashboard/assistant/generate-title', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('authToken')}`,
      },
      body: JSON.stringify({
        conversationSummary,
      }),
    })

    devLog('🌐 LLM title response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    })

    if (response.ok) {
      const data = await response.json()
      devLog('✅ LLM title generated:', data.title)
      return data.title || generateConversationTitleFallback(history)
    } else {
      console.warn('❌ LLM title generation failed:', await response.text())
    }
  } catch (error) {
    console.warn('Failed to generate LLM title, using fallback:', error)
  }

  return generateConversationTitleFallback(history)
}

// Fallback title generation (original logic)
const generateConversationTitleFallback = (history: ConversationEntry[]): string => {
  const firstUserMessage = history.find(entry => entry.role === 'user')
  if (firstUserMessage) {
    const title = firstUserMessage.content.substring(0, 50)
    return title.length < firstUserMessage.content.length ? title + '...' : title
  }
  return `Conversación del ${new Date().toLocaleDateString()}`
}

// Keep original function for backward compatibility
// const generateConversationTitle = generateConversationTitleFallback

// Legacy synchronous wrapper for backward compatibility
export const saveConversationSync = (title?: string, venueSlug?: string | null): string => {
  // For existing calls that expect synchronous behavior, we'll generate a simple ID
  const conversationId = `conv_${venueSlug || getCurrentVenueSlug()}_${Date.now()}`

  // Queue the async save operation but don't wait for it
  saveConversation(title, venueSlug).catch(error => {
    console.error('Error in background conversation save:', error)
  })

  return conversationId
}

// Crear nueva conversación (limpiar la actual) para venue específico
export const createNewConversation = (venueSlug?: string | null): void => {
  const currentVenue = venueSlug || getCurrentVenueSlug()
  const currentUserId = getCurrentUserId()

  // Guardar automáticamente la conversación actual si tiene contenido
  const currentHistory = getConversationHistory(currentVenue, currentUserId)
  if (currentHistory.length > 1) {
    // Más de solo el mensaje de bienvenida
    saveConversationSync(undefined, currentVenue)
  }

  // Limpiar la conversación actual
  clearConversationHistory(currentVenue, currentUserId)
  const currentConversationKey = getUserVenueSpecificKey(STORAGE_KEYS.CURRENT_CONVERSATION, currentVenue, currentUserId)
  localStorage.removeItem(currentConversationKey)
  devLog(`✨ Nueva conversación creada para venue: ${currentVenue}`)
}

// Obtener ID de la conversación actual
export const getCurrentConversationId = (): string | null => {
  const currentVenue = getCurrentVenueSlug()
  const currentUserId = getCurrentUserId()
  const currentConversationKey = getUserVenueSpecificKey(STORAGE_KEYS.CURRENT_CONVERSATION, currentVenue, currentUserId)
  return localStorage.getItem(currentConversationKey)
}

// Submit feedback for AI assistant responses
export const submitFeedback = async (
  trainingDataId: string,
  feedbackType: 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT',
  correctedResponse?: string,
  correctedSql?: string,
  userNotes?: string,
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
  originalQuestion: string,
): Promise<{
  success: boolean
  correctedResponse?: string
  trainingDataId?: string
}> => {
  try {
    // First submit the feedback
    await submitFeedback(trainingDataId, 'INCORRECT', undefined, undefined, problemDescription)

    // Then request a corrected response based on the feedback
    const venueSlug = getCurrentVenueSlug()
    const userId = getCurrentUserId()
    const history = getConversationHistory(venueSlug, userId).map(entry => ({
      ...entry,
      timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp,
    }))
    const payload: Record<string, unknown> = {
      message: `${originalQuestion}\n\nFeedback del usuario: ${problemDescription}`,
      conversationHistory: history,
    }

    if (venueSlug) {
      payload.venueSlug = venueSlug
    }

    if (userId) {
      payload.userId = userId
    }

    const response = await api.post('/api/v1/dashboard/assistant/text-to-sql', payload)

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
    devLog('🏢 Venue context initialized:', currentVenue)
  }
}

// Obtener resumen del estado actual del chat
export const getChatStatus = () => {
  const currentVenue = getCurrentVenueSlug()
  const currentUserId = getCurrentUserId()
  const history = getConversationHistory(currentVenue, currentUserId)
  const stats = getUsageStats(currentVenue, currentUserId)

  return {
    currentVenue,
    hasHistory: history.length > 0,
    messageCount: history.length,
    ...stats,
  }
}

// Función para notificar cambio de venue (usar desde componentes)
export const notifyVenueChange = (newVenueSlug: string): void => {
  const previousVenue = getCurrentVenueSlug()

  // Actualizar venue actual en localStorage
  localStorage.setItem(STORAGE_KEYS.CURRENT_VENUE, newVenueSlug)

  devLog('🔄 Venue change notified:', {
    from: previousVenue,
    to: newVenueSlug,
  })

  // El próximo mensaje del chat detectará el cambio automáticamente
}

// Limpiar toda la información del chat (usar al cerrar sesión)
export const clearAllChatStorage = (): void => {
  try {
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (CHAT_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
  } catch (error) {
    console.error('Error clearing chat storage:', error)
  }
}

// === TOKEN BUDGET API FUNCTIONS ===

export interface TokenBudgetStatus {
  freeTokensRemaining: number
  extraTokensBalance: number // Current balance of purchased tokens (decreases as used)
  totalAvailable: number
  percentageUsed: number
  isInOverage: boolean
  overageTokensUsed: number
  overageCost: number
  warning?: string
  // Historical totals (for display purposes)
  totalTokensPurchased: number // Total tokens ever purchased (doesn't decrease)
  totalTokensUsed: number // Total tokens ever used
  totalAmountSpent: number // Total amount spent on purchases
  pricing: {
    pricePerThousandTokens: number
    currency: string
    freeTokensPerMonth: number
  }
}

/**
 * Get the current token budget status for the venue
 * @returns Token budget status with remaining tokens, usage percentage, and pricing info
 */
export const getTokenBudgetStatus = async (): Promise<TokenBudgetStatus> => {
  try {
    const response = await api.get('/api/v1/dashboard/tokens/status')
    return response.data.data
  } catch (error) {
    devLog('Error fetching token budget status:', error)
    throw error
  }
}

export interface AutoRechargeSettings {
  enabled: boolean
  threshold?: number
  amount?: number
}

export interface TokenPurchaseResult {
  success: boolean
  purchaseId?: string
  clientSecret?: string
  tokenAmount: number
  amountPaid: number
}

/**
 * Purchase additional tokens for the venue
 * @param tokenAmount Number of tokens to purchase (minimum 20000)
 * @param paymentMethodId Stripe payment method ID to charge
 * @returns Purchase result with payment details
 */
export const purchaseTokens = async (tokenAmount: number, paymentMethodId: string): Promise<TokenPurchaseResult> => {
  try {
    const response = await api.post('/api/v1/dashboard/tokens/purchase', { tokenAmount, paymentMethodId })
    return response.data.data
  } catch (error) {
    devLog('Error purchasing tokens:', error)
    throw error
  }
}

/**
 * Update auto-recharge settings for the venue
 * @param settings Auto-recharge configuration
 */
export const updateAutoRecharge = async (settings: AutoRechargeSettings): Promise<void> => {
  try {
    await api.put('/api/v1/dashboard/tokens/auto-recharge', settings)
  } catch (error) {
    devLog('Error updating auto-recharge settings:', error)
    throw error
  }
}

// === TOKEN PURCHASE HISTORY ===

export interface TokenPurchaseRecord {
  id: string
  tokenAmount: number
  amountPaid: string
  purchaseType: 'MANUAL' | 'AUTO_RECHARGE' | 'PROMOTIONAL'
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
  createdAt: string
  completedAt: string | null
  stripeReceiptUrl: string | null // Hosted invoice URL for viewing online
  stripeInvoicePdfUrl: string | null // PDF URL for downloading invoice
}

export interface TokenHistoryResponse {
  usage: {
    records: Array<{
      id: string
      promptTokens: number
      completionTokens: number
      totalTokens: number
      queryType: string
      estimatedCost: string
      createdAt: string
    }>
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
  purchases: {
    records: TokenPurchaseRecord[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

/**
 * Get token purchase and usage history
 * @param options Pagination and date filtering options
 * @returns Token history with usage records and purchase records
 */
export const getTokenHistory = async (options?: {
  page?: number
  limit?: number
  startDate?: string
  endDate?: string
}): Promise<TokenHistoryResponse> => {
  try {
    const params = new URLSearchParams()
    if (options?.page) params.append('page', String(options.page))
    if (options?.limit) params.append('limit', String(options.limit))
    if (options?.startDate) params.append('startDate', options.startDate)
    if (options?.endDate) params.append('endDate', options.endDate)

    const queryString = params.toString()
    const url = `/api/v1/dashboard/tokens/history${queryString ? `?${queryString}` : ''}`
    const response = await api.get(url)
    return response.data.data
  } catch (error) {
    devLog('Error fetching token history:', error)
    throw error
  }
}
