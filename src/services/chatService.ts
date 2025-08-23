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
}

interface ConversationEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
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
}

// Funciones de utilidad para localStorage
const STORAGE_KEYS = {
  CONVERSATION: 'avoqado_chat_history',
  DAILY_USAGE: 'avoqado_chat_daily_usage',
  CONVERSATIONS_LIST: 'avoqado_chat_conversations',
  CURRENT_CONVERSATION: 'avoqado_current_conversation_id',
}

// Gestión del historial de conversación
export const getConversationHistory = (): ConversationEntry[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CONVERSATION)
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

const saveConversationHistory = (history: ConversationEntry[]) => {
  try {
    // Mantener solo los últimos mensajes para reducir tokens
    const recentHistory = history.slice(-CHAT_CONFIG.MAX_HISTORY_LENGTH)
    localStorage.setItem(STORAGE_KEYS.CONVERSATION, JSON.stringify(recentHistory))
    console.log('💾 Chat history saved:', {
      totalEntries: recentHistory.length,
      lastEntry: recentHistory[recentHistory.length - 1],
    })
    return recentHistory
  } catch (error) {
    console.warn('Error saving conversation history:', error)
    return history
  }
}

// Nueva función para agregar mensajes individuales al historial
export const addMessageToHistory = (role: 'user' | 'assistant', content: string) => {
  try {
    const currentHistory = getConversationHistory()
    const newEntry: ConversationEntry = {
      role,
      content,
      timestamp: new Date(),
    }
    
    const updatedHistory = [...currentHistory, newEntry]
    saveConversationHistory(updatedHistory)
    
    console.log('➕ Message added to history:', {
      role,
      contentPreview: content.substring(0, 50) + '...',
      historyLength: updatedHistory.length,
    })
    
    return updatedHistory
  } catch (error) {
    console.error('Error adding message to history:', error)
    return getConversationHistory()
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
    // Preparar historial de conversación
    const history = getConversationHistory()
    
    // Llamar a la API usando axios (que ya tiene la configuración correcta)
    const response = await api.post('/api/v1/dashboard/assistant/query', {
      message,
      conversationHistory: history,
    })
    
    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Error en la respuesta del servidor')
    }
    
    const result = response.data.data
    const aiResponse = result.response || 'No se pudo obtener una respuesta.'
    const suggestions = result.suggestions || []
    
    // NOTA: El historial ahora se maneja desde ChatBubble.tsx para evitar duplicados
    // const newHistory = [
    //   ...history,
    //   { role: 'user' as const, content: message, timestamp: new Date() },
    //   { role: 'assistant' as const, content: aiResponse, timestamp: new Date() }
    // ]
    // saveConversationHistory(newHistory)
    
    // Incrementar contador de uso
    incrementDailyUsage()
    
    console.log('Respuesta obtenida de la API')
    return {
      response: aiResponse,
      suggestions,
      cached: false,
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

// Función para limpiar el historial
export const clearConversationHistory = () => {
  localStorage.removeItem(STORAGE_KEYS.CONVERSATION)
  console.log('Historial de conversación limpiado')
}

// Función para obtener estadísticas de uso
export const getUsageStats = () => {
  const dailyUsage = getDailyUsage()
  const historyLength = getConversationHistory().length
  
  return {
    dailyRequests: dailyUsage.count,
    maxDailyRequests: CHAT_CONFIG.MAX_DAILY_REQUESTS,
    remainingRequests: Math.max(0, CHAT_CONFIG.MAX_DAILY_REQUESTS - dailyUsage.count),
    conversationLength: historyLength,
  }
}

// Función para debugging
export const debugInfo = () => {
  console.log('=== Chat Service Debug Info ===')
  console.log('Usage Stats:', getUsageStats())
  console.log('Conversation History:', getConversationHistory())
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

// Guardar una conversación
export const saveConversation = (title?: string): string => {
  const currentHistory = getConversationHistory()
  if (currentHistory.length === 0) return ''

  const conversations = getSavedConversations()
  const conversationId = `conv_${Date.now()}`
  
  // Generar título automático si no se proporciona
  const autoTitle = title || generateConversationTitle(currentHistory)
  const lastMessage = currentHistory[currentHistory.length - 1]?.content || ''

  const newConversation: SavedConversation = {
    id: conversationId,
    title: autoTitle,
    lastMessage: lastMessage.substring(0, 100) + (lastMessage.length > 100 ? '...' : ''),
    timestamp: new Date(),
    history: [...currentHistory],
  }

  const updatedConversations = [newConversation, ...conversations].slice(0, 10) // Mantener solo las 10 más recientes
  
  try {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS_LIST, JSON.stringify(updatedConversations))
    console.log(`💾 Conversación guardada: ${autoTitle}`)
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

// Crear nueva conversación (limpiar la actual)
export const createNewConversation = (): void => {
  // Guardar automáticamente la conversación actual si tiene contenido
  const currentHistory = getConversationHistory()
  if (currentHistory.length > 1) { // Más de solo el mensaje de bienvenida
    saveConversation()
  }
  
  // Limpiar la conversación actual
  clearConversationHistory()
  localStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION)
  console.log('✨ Nueva conversación creada')
}

// Obtener ID de la conversación actual
export const getCurrentConversationId = (): string | null => {
  return localStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION)
}