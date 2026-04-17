import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Master welcome tour for the complete inventory system.
 *
 * Unlike the atomic tours (category, ingredient, product, stock-adjustment,
 * history, purchase-order) which teach the HOW of each piece, this tour
 * explains the WHY — the philosophy behind the whole system and how the
 * pieces connect.
 *
 * This is a conceptual, popover-only walkthrough — it doesn't navigate
 * between pages. It's ~3 minutes and leaves the admin with a mental model
 * of the full flow: Categoría → Ingrediente → Producto (QUANTITY vs RECIPE)
 * → Orden de Compra → Venta → Historial.
 *
 * Intended entry point: `Resumen de Existencias` page prominent launcher +
 * auto-trigger on first OWNER/ADMIN login (post-MVP).
 */

export function useInventoryWelcomeTour() {
  const { t } = useTranslation('inventory')
  const driverRef = useRef<Driver | null>(null)

  const buildDriver = useCallback((): Driver => {
    const d: Driver = driver({
      showProgress: true,
      allowClose: true,
      animate: true,
      overlayOpacity: 0.7,
      stagePadding: 6,
      stageRadius: 8,
      nextBtnText: t('tour.next', { defaultValue: 'Siguiente →' }),
      prevBtnText: t('tour.prev', { defaultValue: '← Anterior' }),
      doneBtnText: t('tour.done', { defaultValue: '¡Listo!' }),
      progressText: t('tour.progress', {
        defaultValue: 'Paso {{current}} de {{total}}',
      }),
      steps: [
        // 1) Welcome — set expectations
        {
          popover: {
            title: t('tourWelcome.welcome.title', {
              defaultValue: '🎓 Bienvenido al sistema de inventario',
            }),
            description: t('tourWelcome.welcome.description', {
              defaultValue:
                'Este recorrido de <b>3 minutos</b> te enseña el sistema completo. Al final vas a saber:<br/><br/>• Qué hay en cada sección<br/>• Cuándo usar cada una<br/>• Por dónde empezar si es tu primer día<br/><br/><i>Cada sección tiene después su propio tour detallado con el botón <b>"?"</b> arriba a la derecha.</i>',
            }),
          },
        },

        // 2) The two inventory philosophies — the most important concept
        {
          popover: {
            title: t('tourWelcome.methods.title', {
              defaultValue: '🔀 Las 2 formas de controlar tu inventario',
            }),
            description: t('tourWelcome.methods.description', {
              defaultValue:
                'Cada producto puede controlarse de <b>dos maneras</b>:<br/><br/>📦 <b>Por unidad (QUANTITY)</b>: cuentas piezas enteras.<br/><i>Ejemplo: vendes hoodies o tazas — si vendes 1, tu inventario baja en 1.</i><br/><br/>🥣 <b>Por receta (RECIPE)</b>: el producto se hace con ingredientes.<br/><i>Ejemplo: un shake de proteína usa 120 ml de leche + 30 g de proteína. Al vender, se descuentan los ingredientes, no el shake.</i><br/><br/>⚠️ <b>Elige bien</b>: cambiar de método después es lioso.',
            }),
          },
        },

        // 3) Categories — prerequisite
        {
          popover: {
            title: t('tourWelcome.categories.title', {
              defaultValue: '📂 Paso 1 — Categorías',
            }),
            description: t('tourWelcome.categories.description', {
              defaultValue:
                'Todo producto necesita una <b>categoría</b>. Es el primer paso si estás arrancando de cero.<br/><br/>Ejemplos: <b>Bebidas</b>, <b>Comida</b>, <b>Postres</b>, <b>Merch</b>, <b>Shakes</b>.<br/><br/>Te recomendamos crear <b>3-5 categorías</b> antes de crear productos.',
            }),
          },
        },

        // 4) Ingredients — only if RECIPE
        {
          popover: {
            title: t('tourWelcome.ingredients.title', {
              defaultValue: '🥣 Paso 2 — Ingredientes (opcional)',
            }),
            description: t('tourWelcome.ingredients.description', {
              defaultValue:
                'Los <b>ingredientes</b> (raw materials) son los insumos crudos que alimentan tus recetas.<br/><br/><i>Ejemplos: leche, café en grano, proteína, hielo, vaso 12 oz, popote.</i><br/><br/>⚠️ <b>Solo los necesitas si vas a usar el método de RECETA.</b> Si todos tus productos son por unidad (hoodies, tazas), puedes saltarte este paso.',
            }),
          },
        },

        // 5) Products
        {
          popover: {
            title: t('tourWelcome.products.title', {
              defaultValue: '📦 Paso 3 — Productos',
            }),
            description: t('tourWelcome.products.description', {
              defaultValue:
                'Los <b>productos</b> son lo que realmente vendes al cliente. Aquí eliges el método:<br/><br/>• <b>QUANTITY</b>: "Hoodie Negro M" — stock inicial 20 piezas.<br/>• <b>RECIPE</b>: "Shake de Chocolate" — receta de 120ml leche + 30g proteína.<br/><br/>Cada producto se asigna a una <b>categoría</b> (Paso 1) y opcionalmente tiene <b>SKU</b> y <b>código de barras (GTIN)</b>.',
            }),
          },
        },

        // 6) Purchase orders — how stock enters with cost
        {
          popover: {
            title: t('tourWelcome.purchaseOrders.title', {
              defaultValue: '🛒 Paso 4 — Órdenes de compra',
            }),
            description: t('tourWelcome.purchaseOrders.description', {
              defaultValue:
                'Las <b>órdenes de compra</b> son cómo le pides mercancía al proveedor. Al recibirlas, el sistema crea <b>lotes</b> con costo y caducidad.<br/><br/>💡 <b>Clave</b>: Sin órdenes de compra, tus productos con <b>receta</b> no saben cuánto cuestan — el margen queda incorrecto.<br/><br/>Para productos por unidad (QUANTITY), las órdenes de compra son <b>opcionales</b> pero recomendables para llevar el costo.',
            }),
          },
        },

        // 7) Stock summary + adjustments
        {
          popover: {
            title: t('tourWelcome.stockSummary.title', {
              defaultValue: '📊 Paso 5 — Resumen de Existencias',
            }),
            description: t('tourWelcome.stockSummary.description', {
              defaultValue:
                'Tu panel de control diario. Muestra:<br/><br/>• <b>Existencias actuales</b> de cada producto/ingrediente<br/>• <b>Alertas</b> de stock bajo<br/>• <b>Ajustes manuales</b> (merma, daño, robo, recuento)<br/><br/>Desde aquí haces el día a día: <i>"llegó un pedido, corrige esto"</i>, <i>"se rompieron 2 cajas"</i>, <i>"hicimos conteo físico"</i>.',
            }),
          },
        },

        // 8) History — audit trail
        {
          popover: {
            title: t('tourWelcome.history.title', {
              defaultValue: '📋 Paso 6 — Historial',
            }),
            description: t('tourWelcome.history.description', {
              defaultValue:
                'Cada movimiento queda registrado para siempre: ventas, ajustes, órdenes recibidas. Es tu <b>auditoría</b>.<br/><br/>Útil cuando un inventario "no cuadra" y necesitas investigar qué pasó: <i>quién, cuándo, qué hizo y por qué</i>.<br/><br/>⚠️ <b>El historial nunca se borra</b>. Si algo se registró mal, se corrige con un <b>ajuste nuevo</b>, no borrando.',
            }),
          },
        },

        // 9) The full flow recap
        {
          popover: {
            title: t('tourWelcome.flow.title', {
              defaultValue: '🔄 El flujo completo',
            }),
            description: t('tourWelcome.flow.description', {
              defaultValue:
                'Así es como todo se conecta:<br/><br/>1️⃣ Creas <b>Categorías</b><br/>⬇️<br/>2️⃣ (Si usas receta) creas <b>Ingredientes</b><br/>⬇️<br/>3️⃣ Creas <b>Productos</b> (eligiendo QUANTITY o RECIPE)<br/>⬇️<br/>4️⃣ Levantas <b>Órdenes de compra</b> y las recibes → se crean <b>lotes</b> con costo<br/>⬇️<br/>5️⃣ Vendes en <b>TPV</b> → el stock baja automáticamente (unidad o receta)<br/>⬇️<br/>6️⃣ Ajustas manualmente merma/daño en <b>Resumen de Existencias</b><br/>⬇️<br/>7️⃣ Todo queda en <b>Historial</b>',
            }),
          },
        },

        // 10) Complete + next steps
        {
          popover: {
            title: t('tourWelcome.complete.title', {
              defaultValue: '🎉 ¡Ya conoces el sistema!',
            }),
            description: t('tourWelcome.complete.description', {
              defaultValue:
                'Para arrancar, sigue este orden:<br/><br/>✅ <b>Categorías</b> → crea 3-5<br/>✅ <b>Ingredientes</b> (solo si usas recetas)<br/>✅ <b>Productos</b> → 5-10 para empezar<br/>✅ <b>Orden de compra</b> → recibe mercancía inicial<br/>✅ <b>Venta de prueba</b> → verifica que el stock baje correcto<br/><br/>En cada sección verás el botón <b>"?"</b> con el tour detallado. Si te pierdes, regresa aquí y vuelve a abrir este recorrido.<br/><br/>¡Éxito!',
            }),
          },
        },
      ],
    })

    return d
  }, [t])

  const start = useCallback(() => {
    driverRef.current?.destroy()
    driverRef.current = buildDriver()
    driverRef.current.drive()
  }, [buildDriver])

  const stop = useCallback(() => {
    driverRef.current?.destroy()
    driverRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      driverRef.current?.destroy()
    }
  }, [])

  return { start, stop }
}
