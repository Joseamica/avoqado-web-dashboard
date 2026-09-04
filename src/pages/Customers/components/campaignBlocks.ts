import type { CampaignBlock } from '@/services/marketing.service'

/**
 * Los 5 tipos de bloque que el SERVIDOR sabe renderizar (`campaignBlocks.ts` del backend).
 *
 * Viven aquí y no junto al editor porque los usan también las pantallas que sólo filtran
 * bloques desconocidos, y porque exportar constantes desde un archivo de componentes rompe
 * el fast refresh de Vite.
 */
export const TIPOS_DE_BLOQUE: CampaignBlock['type'][] = ['heading', 'paragraph', 'image', 'button', 'divider']

/** Un bloque recién añadido, vacío pero del tipo correcto. */
export function bloqueVacio(type: CampaignBlock['type']): CampaignBlock {
	switch (type) {
		case 'heading':
			return { type: 'heading', text: '' }
		case 'paragraph':
			return { type: 'paragraph', text: '' }
		case 'image':
			return { type: 'image', url: '', alt: '' }
		case 'button':
			return { type: 'button', label: '', url: '' }
		case 'divider':
			return { type: 'divider' }
	}
}
