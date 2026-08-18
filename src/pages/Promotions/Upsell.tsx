import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Eye, Info, Lightbulb, Loader2, MessageSquare, Plus, Sparkles, Store, Tag, Trash2, Users, Wifi, X, Zap } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'

import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { PermissionGate } from '@/components/PermissionGate'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useVenueTier } from '@/hooks/use-tier-feature-access'
import { Currency } from '@/utils/currency'
import { getProducts } from '@/services/menu.service'
import { suggestabilityOf, coversAllRequiredGroups } from '@/lib/upsell/suggestability'
import { resolveSuggestionPreview, chosenPreviewModifiers } from '@/lib/upsell/preview'
import {
	upsellService,
	type UpsellOrigin,
	type UpsellRule,
	type UpsellSurfaces,
	type UpsellTriggerType,
} from '@/services/upsell.service'

/**
 * Upsell "¿Algo más?" — configuración.
 *
 * Spec: Avoqado-HQ/specs/upsell-pantalla-cliente-2026-08-03.md
 *
 * Esta pantalla es lo único que convierte el motor en algo usable: sin ella el POS
 * tiene la función pero nadie puede prenderla ni decirle qué sugerir.
 */

const ORIGIN_LABEL: Record<UpsellOrigin, { text: string; hint: string }> = {
	OWNER: { text: 'Tuya', hint: 'La escribiste tú' },
	BASKET_DATA: { text: 'De tus ventas', hint: 'Salió del historial de este negocio' },
	AI: { text: 'Sugerida por IA', hint: 'Propuesta a partir de tu menú' },
	PROMOTION: { text: 'De una promoción', hint: 'Nace de un descuento activo y muere con él' },
}

function OriginBadge({ origin }: { origin: UpsellOrigin }) {
	const def = ORIGIN_LABEL[origin]
	return (
		<Badge variant="outline" title={def.hint} className="font-normal">
			{origin === 'AI' && <Sparkles className="mr-1 h-3 w-3" />}
			{def.text}
		</Badge>
	)
}

// ═══════════════════════════════════════════════════════════════════════════
// Desempeño — DOS números, y la diferencia entre ellos importa
// ═══════════════════════════════════════════════════════════════════════════

function PerformancePanel({ venueId }: { venueId: string }) {
	const { data, isLoading } = useQuery({
		queryKey: ['upsell-performance', venueId],
		queryFn: () => upsellService.getPerformance(venueId),
	})

	if (isLoading) return <Skeleton className="h-36 w-full" />
	if (!data?.hasData) {
		return (
			<Card>
				<CardContent className="py-8 text-center text-sm text-muted-foreground">
					Todavía no hay datos. Aparecerán cuando el POS empiece a mostrar sugerencias.
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="grid gap-4 md:grid-cols-3">
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium text-muted-foreground">Se ofreció</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{data.shownCount.toLocaleString('es-MX')}</div>
					<p className="mt-1 text-xs text-muted-foreground">
						Aceptaron {data.acceptedCount.toLocaleString('es-MX')} ({(data.acceptanceRate * 100).toFixed(1)}%)
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium text-muted-foreground">Ventas atribuidas</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{Currency(data.attributedSales)}</div>
					{/* Honestidad explícita: este número NO es el aumento. */}
					<p className="mt-1 text-xs text-muted-foreground">
						Lo que se vendió desde las tarjetas. No descuenta lo que el cliente habría comprado igual.
					</p>
				</CardContent>
			</Card>

			<Card className="border-primary/40">
				<CardHeader className="pb-2">
					<CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
						Aumento real del ticket
					</CardTitle>
				</CardHeader>
				<CardContent>
					{data.measuredLift === null ? (
						<>
							<div className="text-2xl font-bold text-muted-foreground">—</div>
							<p className="mt-1 text-xs text-muted-foreground">
								Aún sin muestra suficiente. Se calcula comparando contra las ventas donde, al azar, no
								mostramos nada.
							</p>
						</>
					) : (
						<>
							<div className="text-2xl font-bold">{Currency(data.measuredLift)}</div>
							<p className="mt-1 text-xs text-muted-foreground">
								Por ticket, contra {data.holdoutCount.toLocaleString('es-MX')} ventas de control.
							</p>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

// ═══════════════════════════════════════════════════════════════════════════
// Las tres perillas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔴 `comingSoon` NO es un adorno: hoy el POS SÓLO actúa sobre `counter`.
 *
 * Dejar prendibles las otras dos sería peor que no mostrarlas — el dueño cree que
 * su equipo está ofreciendo postre en las mesas y no está pasando nada. Y en el caso
 * de cobrar-en-mesa, habilitarlo de verdad hoy COBRARÍA un producto que la orden del
 * servidor nunca registra (sin inventario, fuera de ventas por producto, $0 en el
 * reporte). Se prenden cuando exista el acomodador de mesa (ADD_ITEMS con
 * comparación de versión), no antes.
 */
const SURFACE_DEFS: Array<{
	key: keyof UpsellSurfaces
	icon: typeof Store
	title: string
	description: string
	warning?: string
	comingSoon?: boolean
}> = [
	{
		key: 'counter',
		icon: Store,
		title: 'En el mostrador',
		description: 'Al cobrar, el cliente ve las tarjetas en su pantalla y el cajero en la suya.',
	},
	{
		key: 'tableOrdering',
		icon: Users,
		title: 'Cuando el mesero toma la orden',
		description: 'La sugerencia le aparece al mesero mientras arma la cuenta. Es donde más se vende postre y café.',
		comingSoon: true,
	},
	{
		key: 'tablePaying',
		icon: Tag,
		title: 'Cuando el cliente paga su mesa en caja',
		description: 'El cliente se acerca a pagar y ve las tarjetas en la pantalla del mostrador.',
		warning: 'Requiere internet: el producto se agrega a una cuenta que ya vive en el servidor.',
		comingSoon: true,
	},
]

function SurfacesPanel({ venueId }: { venueId: string }) {
	const queryClient = useQueryClient()
	const { toast } = useToast()

	const { data: surfaces, isLoading } = useQuery({
		queryKey: ['upsell-surfaces', venueId],
		queryFn: () => upsellService.getSurfaces(venueId),
	})

	const mutation = useMutation({
		mutationFn: (next: UpsellSurfaces) => upsellService.setSurfaces(venueId, next),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['upsell-surfaces', venueId] })
			toast({ title: 'Guardado' })
		},
		onError: () => toast({ title: 'No se pudo guardar', variant: 'destructive' }),
	})

	if (isLoading || !surfaces) return <Skeleton className="h-48 w-full" />

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">¿Dónde aparece?</CardTitle>
			</CardHeader>
			<CardContent className="space-y-1">
				{SURFACE_DEFS.map((def, i) => {
					const Icon = def.icon
					return (
						<div key={def.key}>
							{i > 0 && <Separator className="my-3" />}
							<div className="flex items-start justify-between gap-4">
								<div className="flex gap-3">
									<Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
									<div>
										<p className="flex items-center gap-2 text-sm font-medium">
											{def.title}
											{def.comingSoon && (
												<Badge variant="secondary" className="font-normal">
													Próximamente
												</Badge>
											)}
										</p>
										<p className="mt-0.5 text-xs text-muted-foreground">{def.description}</p>
										{def.warning && (
											<p className="mt-1 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-500">
												<Wifi className="mt-0.5 h-3 w-3 shrink-0" />
												{def.warning}
											</p>
										)}
										{def.comingSoon && (
											<p className="mt-1 text-xs text-muted-foreground">
												Todavía no está disponible en el punto de venta. Hoy las sugerencias sólo aparecen en el
												mostrador.
											</p>
										)}
									</div>
								</div>
								<PermissionGate permission="upsells:update">
									{/* Deshabilitado, no oculto: que se vea a dónde va la función sin
									    dejar prender algo que no ocurre. */}
									<Switch
										checked={def.comingSoon ? false : surfaces[def.key]}
										disabled={mutation.isPending || def.comingSoon}
										onCheckedChange={checked => mutation.mutate({ ...surfaces, [def.key]: checked })}
									/>
								</PermissionGate>
							</div>
						</div>
					)
				})}
			</CardContent>
		</Card>
	)
}

// ═══════════════════════════════════════════════════════════════════════════
// Alta de una regla
// ═══════════════════════════════════════════════════════════════════════════

/**
 * El botón que crea vive en el ENCABEZADO del modal (patrón obligatorio), no
 * abajo del formulario: se conectan por este id, igual que `ProductWizardDialog`.
 */
const CREATE_RULE_FORM_ID = 'upsell-create-rule-form'

/**
 * Encabezado de sección — el mismo bloque que usa `ProductWizardDialog`, que es
 * la referencia obligatoria de `.claude/rules/ui-patterns.md` para cualquier
 * alta dentro de un `FullScreenModal`.
 */
function SectionHeader({ icon: Icon, title }: { icon: typeof Store; title: string }) {
	return (
		<div className="mb-6 flex items-center gap-3">
			<div className="rounded-xl bg-primary/10 p-2.5">
				<Icon className="h-5 w-5 text-primary" />
			</div>
			<h2 className="text-lg font-semibold">{title}</h2>
		</div>
	)
}

function CreateRuleDialog({ venueId, open, onOpenChange }: { venueId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
	const queryClient = useQueryClient()
	const { toast } = useToast()

	const [triggerType, setTriggerType] = useState<UpsellTriggerType>('ALWAYS')
	const [triggerProductIds, setTriggerProductIds] = useState<string[]>([])
	const [suggestedProductId, setSuggestedProductId] = useState('')
	const [headline, setHeadline] = useState('')
	// Opciones obligatorias del producto elegido (B3): groupId -> modifierId.
	const [modifierPicks, setModifierPicks] = useState<Record<string, string>>({})

	// Catálogo completo: sirve para el disparador (cualquier producto puede
	// disparar) y para el sugerido (con su motivo si no se puede sugerir).
	const { data: products, isLoading: loadingProducts } = useQuery({
		queryKey: ['products-for-upsell', venueId],
		queryFn: () => getProducts(venueId, { orderBy: 'name', includeRecipe: false, includeModifiers: true }),
		enabled: open,
	})

	// 🔴 Se anota TODO el catálogo con el motivo — nunca se filtra. Ver el motivo
	// vale más que no ver el producto, y las que sólo piden opciones obligatorias
	// se pueden resolver aquí mismo (ver `gruposObligatorios` abajo).
	const anotados = useMemo(
		() => (products ?? []).map((p: any) => ({ ...p, suggestability: suggestabilityOf(p) })),
		[products],
	)
	const productoElegido = anotados.find((p: any) => p.id === suggestedProductId)
	const gruposObligatorios = (productoElegido?.modifierGroups ?? []).filter((g: any) => g.group?.required)

	// 🔴 Spec §4.2, ronda final de correcciones (2026-08-17): vista previa con el
	// nombre resuelto y el precio final — no existía, así que el dueño elegía
	// "Grande" y nunca veía, antes de guardar, que la tarjeta iba a decir
	// "Agua Mineral 1L (Grande)" a $50.00 y no los $35.00 de la ficha. Sólo se
	// suman los modificadores YA elegidos (no todo el grupo obligatorio), así se
	// actualiza en vivo conforme el dueño va escogiendo — el botón "Crear" sigue
	// deshabilitado hasta que `obligatoriosResueltos` sea true, más abajo.
	const modificadoresElegidos = chosenPreviewModifiers(gruposObligatorios, modifierPicks)
	const preview = resolveSuggestionPreview(productoElegido, modificadoresElegidos)

	const create = useMutation({
		mutationFn: () =>
			upsellService.createRule(venueId, {
				triggerType,
				triggerProductIds: triggerType === 'PRODUCT' ? triggerProductIds : undefined,
				suggestedProductId,
				suggestedModifiers: gruposObligatorios.map((g: any) => ({
					groupId: g.group.id,
					modifierId: modifierPicks[g.group.id],
				})),
				headline: headline.trim() || null,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['upsell-rules', venueId] })
			toast({ title: 'Sugerencia creada' })
			onOpenChange(false)
			setTriggerType('ALWAYS')
			setTriggerProductIds([])
			setSuggestedProductId('')
			setModifierPicks({})
			setHeadline('')
		},
		onError: (e: any) =>
			toast({
				title: 'No se pudo crear',
				description: e?.response?.data?.message ?? 'Revisa los datos e intenta de nuevo.',
				variant: 'destructive',
			}),
	})

	const obligatoriosResueltos = gruposObligatorios.every((g: any) => modifierPicks[g.group.id])
	const canSubmit = !!suggestedProductId && obligatoriosResueltos && (triggerType !== 'PRODUCT' || triggerProductIds.length > 0)

	// Catálogo vacío ≠ catálogo cargando: se separan para no pintar el callejón
	// sin salida antes de tiempo.
	const sinProductos = !loadingProducts && (products ?? []).length === 0

	// El botón "Crear" vive en el encabezado del modal, así que dispara este
	// formulario por `form=` + `type="submit"` — igual que `ProductWizardDialog`.
	// De regalo, Enter dentro del formulario también crea.
	const submit = (e: FormEvent) => {
		e.preventDefault()
		if (!canSubmit || create.isPending) return
		create.mutate()
	}

	return (
		<FullScreenModal
			open={open}
			onClose={() => onOpenChange(false)}
			title="Nueva sugerencia"
			subtitle="Define qué producto ofrecer y en qué momento"
			contentClassName="bg-muted/30"
			actions={
				<Button
					type="submit"
					form={CREATE_RULE_FORM_ID}
					data-tour="upsell-rule-submit"
					disabled={!canSubmit || create.isPending || loadingProducts || sinProductos}
				>
					{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					Crear
				</Button>
			}
		>
			<div className="mx-auto max-w-5xl space-y-6 p-6">
				{loadingProducts ? (
					<Skeleton className="h-64 w-full" />
				) : sinProductos ? (
					// Callejón sin salida honesto: sin productos en el catálogo no hay
					// nada que ofrecer.
					<section className="rounded-2xl border border-border/50 bg-card p-6">
						<div className="space-y-2 py-6 text-center">
							<p className="text-sm font-medium">Todavía no hay productos en tu menú</p>
							<p className="text-sm text-muted-foreground">Agrega productos a tu menú antes de crear una sugerencia.</p>
						</div>
					</section>
				) : (
					<form id={CREATE_RULE_FORM_ID} onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
						<div className="space-y-6 lg:col-span-8">
							{/* ── Cuándo se ofrece ─────────────────────────────────── */}
							<section className="rounded-2xl border border-border/50 bg-card p-6">
								<SectionHeader icon={Zap} title="¿Cuándo se ofrece?" />

								<div className="space-y-5">
									<div className="space-y-2">
										<Label htmlFor="upsell-trigger-type">Momento</Label>
										<Select value={triggerType} onValueChange={v => setTriggerType(v as UpsellTriggerType)}>
											<SelectTrigger id="upsell-trigger-type" className="h-12" data-tour="upsell-rule-trigger-type">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="ALWAYS">Siempre, en cualquier cuenta</SelectItem>
												<SelectItem value="PRODUCT">Sólo si ya llevan cierto producto</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{triggerType === 'PRODUCT' && (
										<div className="space-y-2">
											<Label htmlFor="upsell-trigger-product">Producto que dispara</Label>
											<Select value={triggerProductIds[0] ?? ''} onValueChange={v => setTriggerProductIds([v])}>
												<SelectTrigger id="upsell-trigger-product" className="h-12" data-tour="upsell-rule-trigger-product">
													<SelectValue placeholder="Elige un producto" />
												</SelectTrigger>
												<SelectContent>
													{(products ?? []).map((p: any) => (
														<SelectItem key={p.id} value={p.id}>
															{p.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									)}
								</div>
							</section>

							{/* ── Qué se ofrece ────────────────────────────────────── */}
							<section className="rounded-2xl border border-border/50 bg-card p-6">
								<SectionHeader icon={Tag} title="¿Qué se ofrece?" />

								<div className="space-y-5">
									<div className="space-y-2">
										<Label htmlFor="upsell-suggested-product">Producto a sugerir</Label>
										<Select
											value={suggestedProductId}
											onValueChange={v => {
												setSuggestedProductId(v)
												// Opciones de un producto distinto: nunca heredar la selección anterior.
												setModifierPicks({})
											}}
										>
											<SelectTrigger id="upsell-suggested-product" className="h-12" data-tour="upsell-rule-suggested-product">
												{/* Children explícitos: si dejáramos que Select mirara el texto del SelectItem
												seleccionado, el motivo (para las resolubles) se colaría también aquí una vez
												elegidas — Radix copia TODO el contenido del item. */}
												<SelectValue placeholder="Elige un producto">{productoElegido?.name}</SelectValue>
											</SelectTrigger>
											<SelectContent>
												{anotados.map((p: any) => (
													<SelectItem key={p.id} value={p.id} disabled={p.suggestability.blocked && !p.suggestability.resolvable}>
														{p.name}
														{p.suggestability.label && (
															<span className="ml-2 text-xs text-muted-foreground">{p.suggestability.label}</span>
														)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<p className="text-xs text-muted-foreground">
											Los atenuados no se pueden sugerir; el motivo aparece junto al nombre.
										</p>
									</div>

									{gruposObligatorios.length > 0 && (
										<div className="space-y-3 rounded-xl border border-input bg-muted/30 p-4" data-tour="upsell-rule-modifiers">
											<p className="text-xs text-muted-foreground">
												Esta sugerencia se agrega con un toque, así que hay que dejar elegidas sus opciones desde ahora.
											</p>
											{gruposObligatorios.map((g: any) => (
												<div key={g.group.id} className="space-y-1.5">
													<Label className="text-xs" htmlFor={`upsell-modifier-${g.group.id}`}>
														{g.group.name}
													</Label>
													<Select
														value={modifierPicks[g.group.id] ?? ''}
														onValueChange={v => setModifierPicks(prev => ({ ...prev, [g.group.id]: v }))}
													>
														<SelectTrigger
															id={`upsell-modifier-${g.group.id}`}
															className="h-12"
															data-tour={`upsell-rule-modifier-${g.group.id}`}
														>
															<SelectValue placeholder="Elige una opción" />
														</SelectTrigger>
														<SelectContent>
															{(g.group.modifiers ?? []).map((m: any) => (
																<SelectItem key={m.id} value={m.id}>
																	{m.name}
																	{m.price ? ` (+${Currency(m.price)})` : ''}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
											))}
										</div>
									)}
								</div>
							</section>

							{/* ── El gancho ────────────────────────────────────────── */}
							<section className="rounded-2xl border border-border/50 bg-card p-6">
								<SectionHeader icon={MessageSquare} title="El gancho" />

								<div className="space-y-2">
									<Label htmlFor="upsell-headline">Gancho (opcional)</Label>
									<Input
										id="upsell-headline"
										className="h-12 text-base"
										value={headline}
										maxLength={120}
										placeholder="¿Le agregamos un croissant calientito?"
										data-tour="upsell-rule-headline"
										onChange={e => setHeadline(e.target.value)}
									/>
									<p className="text-xs text-muted-foreground">
										Lo lee el cliente en su pantalla. Si lo dejas vacío, se usa el nombre del producto.
									</p>
								</div>
							</section>
						</div>

						{/* ── Vista previa ─────────────────────────────────────────
								Spec §4.2: el nombre resuelto y el precio final, para que nadie
								confirme una regla sin ver primero qué precio va a mostrar la
								pantalla del cliente. En su propia columna y pegada arriba: se
								actualiza en vivo mientras el dueño elige las opciones
								obligatorias, que es justo cuando el precio cambia sin avisar. */}
						<div className="lg:col-span-4">
							<section className="rounded-2xl border border-border/50 bg-card p-6 lg:sticky lg:top-6" data-tour="upsell-rule-preview">
								<SectionHeader icon={Eye} title="Así se va a ver la tarjeta" />

								{preview ? (
									<div className="space-y-3">
										<div className="rounded-xl border border-input bg-muted/30 p-4">
											<p className="text-sm font-medium">{preview.name}</p>
											<p className="mt-1 text-lg font-semibold tabular-nums">{Currency(preview.finalPrice)}</p>
										</div>
										<p className="text-xs text-muted-foreground">Es el nombre y el precio que el cliente lee en su pantalla.</p>
									</div>
								) : (
									<p className="text-sm text-muted-foreground">
										Elige el producto a sugerir y aquí verás el nombre y el precio final que le aparece al cliente.
									</p>
								)}
							</section>
						</div>
					</form>
				)}
			</div>
		</FullScreenModal>
	)
}

// ═══════════════════════════════════════════════════════════════════════════
// Reglas
// ═══════════════════════════════════════════════════════════════════════════

function RuleRow({ rule, venueId }: { rule: UpsellRule; venueId: string }) {
	const queryClient = useQueryClient()
	const { toast } = useToast()
	const invalidate = () => queryClient.invalidateQueries({ queryKey: ['upsell-rules', venueId] })

	const approve = useMutation({
		mutationFn: () => upsellService.approveRule(venueId, rule.id),
		onSuccess: () => {
			invalidate()
			toast({ title: 'Sugerencia activada' })
		},
		// El server responde 400 cuando el producto sigue bloqueado (pide opciones sin
		// resolver, vetado, desactivado…) y la regla se queda en PROPOSED — eso es
		// correcto. Lo que NO era correcto es que antes ese 400 desaparecía en
		// silencio: cero toast, cero [role=alert], y el botón seguía habilitado para
		// que el dueño lo picara otra vez. Mismo patrón que CreateRuleDialog.create.
		onError: (e: any) =>
			toast({
				title: 'No se pudo activar',
				description: e?.response?.data?.message ?? 'Revisa el producto e intenta de nuevo.',
				variant: 'destructive',
			}),
	})
	const dismiss = useMutation({
		mutationFn: () => upsellService.dismissRule(venueId, rule.id),
		onSuccess: () => {
			invalidate()
			toast({ title: 'Descartada', description: 'No la volveremos a proponer.' })
		},
	})

	// "1 producto(s)" se lee a software sin terminar, y "1 cierto producto" tampoco
	// es español. El singular pierde el número; sólo el plural lo necesita.
	const trigger =
		rule.triggerType === 'ALWAYS'
			? 'Siempre'
			: rule.triggerType === 'PRODUCT'
				? rule.triggerProductIds.length === 1
					? 'Cuando la cuenta lleva cierto producto'
					: `Cuando la cuenta lleva alguno de ${rule.triggerProductIds.length} productos`
				: rule.triggerCategoryIds.length === 1
					? 'Cuando la cuenta lleva algo de cierta categoría'
					: `Cuando la cuenta lleva algo de ${rule.triggerCategoryIds.length} categorías`

	// El badge usa el motivo REAL (los 5 filtros del POS), no sólo el veto. Pero
	// una regla YA resuelta (sus opciones obligatorias elegidas) no debe salir
	// como bloqueada por PIDE_OPCIONES — ese motivo se ignora cuando la selección
	// CUBRE TODOS los grupos obligatorios del producto.
	//
	// 🔴 Ronda final de correcciones (2026-08-17): antes preguntaba "¿trae
	// ALGUNA selección?" (`suggestedModifiers.length > 0`) — un producto con 2
	// obligatorios y una regla que sólo resolvió 1 pasaba esa pregunta, el badge
	// desaparecía, y el POS (que exige `coversAllRequiredGroups`, el subconjunto
	// COMPLETO) seguía descartando la tarjeta. `coversAllRequiredGroups` es la
	// misma pregunta ESTRICTA que hace el POS.
	const suggestability = rule.suggestedProduct ? suggestabilityOf(rule.suggestedProduct) : null
	const bloqueadoDeVerdad =
		!!suggestability?.blocked &&
		!(
			suggestability.reason === 'PIDE_OPCIONES' &&
			rule.suggestedProduct &&
			coversAllRequiredGroups(rule.suggestedProduct, rule.suggestedModifiers)
		)

	// Apagado no puede ser mudo (regla del workspace): el porqué ya lo dice el
	// badge de abajo (`suggestability.label`); esto agrega el QUÉ HACER. Sólo
	// PIDE_OPCIONES se resuelve recreando la regla — el resto (vetado,
	// desactivado, por peso…) se arregla en Catálogo.
	const comoResolver = suggestability?.resolvable
		? 'Descártala y créala de nuevo desde "+ Nueva regla" para elegir la opción obligatoria.'
		: 'Corrígelo en Catálogo o descarta la propuesta.'

	return (
		<div className="flex items-start justify-between gap-4 py-3">
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm font-medium">{rule.suggestedProduct?.name ?? 'Producto'}</span>
					<OriginBadge origin={rule.origin} />
					{/* El producto puede haber dejado de ser sugerible aunque la regla exista. */}
					{bloqueadoDeVerdad && suggestability && (
						<Badge variant="destructive" className="font-normal">
							{suggestability.label}
						</Badge>
					)}
				</div>
				<p className="mt-0.5 text-xs text-muted-foreground">
					{trigger}
					{rule.headline ? ` · “${rule.headline}”` : ''}
				</p>
				{/* La evidencia con la que el dueño decide. */}
				{rule.rationale && (
					<p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
						<Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
						{rule.rationale}
					</p>
				)}
				{/* Apagado no puede ser mudo: esto SIEMPRE se ve, nunca depende de hover
				    (un title en un botón disabled no dispara — pointer-events:none — y en
				    tablet, el dispositivo principal del founder, no hay hover de todos
				    modos). El badge de arriba ya dice QUÉ pasa; esto dice QUÉ HACER. */}
				{bloqueadoDeVerdad && (
					<p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
						<Info className="mt-0.5 h-3 w-3 shrink-0" />
						{comoResolver}
					</p>
				)}
			</div>

			<PermissionGate permission="upsells:update">
				<div className="flex shrink-0 gap-1">
					{rule.status === 'PROPOSED' ? (
						<>
							<Button
								size="sm"
								variant="outline"
								disabled={approve.isPending || bloqueadoDeVerdad}
								onClick={() => approve.mutate()}
							>
								<Check className="mr-1 h-3.5 w-3.5" />
								Activar
							</Button>
							<Button size="sm" variant="ghost" disabled={dismiss.isPending} onClick={() => dismiss.mutate()}>
								<X className="h-3.5 w-3.5" />
							</Button>
						</>
					) : (
						<Button size="sm" variant="ghost" disabled={dismiss.isPending} onClick={() => dismiss.mutate()}>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					)}
				</div>
			</PermissionGate>
		</div>
	)
}

/**
 * Generación por IA — el ÚNICO punto PREMIUM de esta pantalla.
 *
 * Resuelve el arranque en frío: un negocio recién abierto no tiene historial de
 * ventas, así que el motor de datos no encuentra nada. La IA lee el menú, que sí
 * existe desde el día uno.
 *
 * 🔴 Gasta tokens de Avoqado, y el backend lo defiende con arrendamiento, cooldown
 * de 24 h y tope. Cada rechazo trae su `code` para poder decir qué pasó de verdad —
 * un "error" genérico frente a un cooldown hace que el dueño le pique diez veces.
 */
function GenerateWithAiButton({ venueId }: { venueId: string }) {
	const queryClient = useQueryClient()
	const { toast } = useToast()
	const { hasFeatureAccess } = useVenueTier()
	const hasAi = hasFeatureAccess('UPSELL_AI')

	const generate = useMutation({
		mutationFn: () => upsellService.generateWithAi(venueId),
		onSuccess: result => {
			queryClient.invalidateQueries({ queryKey: ['upsell-rules', venueId] })
			toast({
				title: result.proposed > 0 ? `${result.proposed} sugerencias nuevas` : 'Sin sugerencias nuevas',
				description: result.message,
			})
		},
		onError: (error: any) => {
			const code = error?.response?.data?.code
			const message = error?.response?.data?.message
			toast({
				variant: code === 'COOLDOWN' ? 'default' : 'destructive',
				title:
					code === 'COOLDOWN'
						? 'Ya se generaron hoy'
						: code === 'NO_CATALOG'
							? 'Falta marcar productos'
							: code === 'ALREADY_RUNNING'
								? 'Ya va en camino'
								: 'No se pudo generar',
				description: message ?? 'Intenta de nuevo en unos minutos.',
			})
		},
	})

	// Sin PREMIUM el botón se ve, con candado. Ocultarlo dejaría al dueño sin
	// enterarse de que la capacidad existe.
	if (!hasAi) {
		return (
			<Button
				size="sm"
				variant="outline"
				onClick={() =>
					toast({
						title: 'Generar con IA es de Premium',
						description: 'El resto de las sugerencias funciona en tu plan. Esto sólo escribe las propuestas por ti.',
					})
				}
			>
				<Sparkles className="mr-1 h-4 w-4" />
				Generar con IA
				<Badge variant="secondary" className="ml-1.5 font-normal">
					Premium
				</Badge>
			</Button>
		)
	}

	return (
		<Button size="sm" variant="outline" disabled={generate.isPending} onClick={() => generate.mutate()}>
			<Sparkles className="mr-1 h-4 w-4" />
			{generate.isPending ? 'Generando…' : 'Generar con IA'}
		</Button>
	)
}

function RulesPanel({ venueId }: { venueId: string }) {
	const [creating, setCreating] = useState(false)
	const { data: rules, isLoading } = useQuery({
		queryKey: ['upsell-rules', venueId],
		queryFn: () => upsellService.getRules(venueId),
	})

	const { proposed, active } = useMemo(() => {
		const all = rules ?? []
		return {
			proposed: all.filter(r => r.status === 'PROPOSED'),
			active: all.filter(r => r.status === 'ACTIVE'),
		}
	}, [rules])

	if (isLoading) return <Skeleton className="h-64 w-full" />

	return (
		<div className="space-y-4">
			{/* Las propuestas van PRIMERO: son las que esperan una decisión. */}
			{proposed.length > 0 && (
				<Card className="border-primary/40">
					<CardHeader>
						<CardTitle className="text-base">Esperan tu decisión ({proposed.length})</CardTitle>
					</CardHeader>
					<CardContent className="divide-y">
						{proposed.map(r => (
							<RuleRow key={r.id} rule={r} venueId={venueId} />
						))}
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader className="flex-row items-center justify-between space-y-0">
					<CardTitle className="text-base">Activas ({active.length})</CardTitle>
					<PermissionGate permission="upsells:create">
						<div className="flex gap-2">
							<GenerateWithAiButton venueId={venueId} />
							<Button size="sm" data-tour="upsell-rule-new" onClick={() => setCreating(true)}>
								<Plus className="mr-1 h-4 w-4" />
								Nueva
							</Button>
						</div>
					</PermissionGate>
				</CardHeader>
				<CardContent className={active.length ? 'divide-y' : ''}>
					{active.length === 0 ? (
						<p className="py-6 text-center text-sm text-muted-foreground">
							Todavía no hay sugerencias activas. Marca productos como sugeribles desde su ficha; de ahí en
							adelante te proponemos solos, cada noche, lo que tus tickets muestran que se vende junto.
						</p>
					) : (
						active.map(r => <RuleRow key={r.id} rule={r} venueId={venueId} />)
					)}
				</CardContent>
			</Card>

			<CreateRuleDialog venueId={venueId} open={creating} onOpenChange={setCreating} />
		</div>
	)
}

// ═══════════════════════════════════════════════════════════════════════════

export default function Upsell() {
	const { venueId } = useCurrentVenue()
	const [showHelp, setShowHelp] = useState(false)

	if (!venueId) return null

	return (
		<FeatureGate feature="UPSELL">
			<div className="space-y-6 p-4">
				<div className="flex items-start justify-between gap-4">
					<PageTitleWithInfo
						title="Sugerencias al cobrar"
						tooltip="Muestra 2 o 3 productos en la pantalla del cliente justo antes de pagar, para subir el ticket."
					/>
					<Button variant="ghost" size="sm" onClick={() => setShowHelp(v => !v)}>
						<Info className="mr-1 h-4 w-4" />
						Cómo funciona
					</Button>
				</div>

				{showHelp && (
					<Card className="bg-muted/40">
						<CardContent className="space-y-2 py-4 text-sm text-muted-foreground">
							<p>
								Cuando el cajero da <strong>Cobrar</strong>, al cliente le aparecen hasta 3 productos en su
								pantalla con un “¿Algo más?”. Toca los que quiera y confirma; se agregan a su cuenta antes de
								pagar.
							</p>
							<p>
								Nada se sugiere solo: primero marcas qué productos pueden aparecer, desde la ficha de cada
								producto. Ese permiso manda sobre todo lo demás.
							</p>
							<p>
								Para saber si de verdad sirve, en 1 de cada 10 ventas <strong>no</strong> mostramos nada, al
								azar. Comparar esas ventas contra las demás es lo que da el “aumento real del ticket”.
							</p>
						</CardContent>
					</Card>
				)}

				<PerformancePanel venueId={venueId} />
				<SurfacesPanel venueId={venueId} />
				<RulesPanel venueId={venueId} />
			</div>
		</FeatureGate>
	)
}
