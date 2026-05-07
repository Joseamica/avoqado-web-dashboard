import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Copy,
  Check,
  ExternalLink,
  Code2,
  Globe,
  Settings,
  Frame,
  MousePointerClick,
  ShieldAlert,
  Calendar as CalendarIcon,
  Users as UsersIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getProducts } from '@/services/menu.service'

type Locale = 'es' | 'en'
type Theme = 'auto' | 'light' | 'dark'
type Mode = 'inline' | 'button' | 'popup'

function useCopyToClipboard() {
	const [copied, setCopied] = useState(false)
	function copy(text: string) {
		navigator.clipboard.writeText(text).then(() => {
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		})
	}
	return { copied, copy }
}

interface CodeBlockProps {
	code: string
}

function CodeBlock({ code }: CodeBlockProps) {
	const { copied, copy } = useCopyToClipboard()
	return (
		<div className="relative">
			<pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm leading-relaxed">
				<code>{code}</code>
			</pre>
			<Button
				size="sm"
				variant="ghost"
				className="absolute right-2 top-2 h-8 w-8 p-0"
				onClick={() => copy(code)}
			>
				{copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
			</Button>
		</div>
	)
}

export default function OnlineBookingPage() {
	const { t } = useTranslation('reservations')
	const { venue, fullBasePath, venueSlug } = useCurrentVenue()

	const [locale, setLocale] = useState<Locale>('es')
	const [theme, setTheme] = useState<Theme>('auto')
	const [mode, setMode] = useState<Mode>('inline')

	const slug = venueSlug ?? 'your-venue-slug'

	// Public booking URLs — canonical host is book.avoqado.io.
	// Three "channels" mirror Square's pattern:
	//   - /<slug>                unified landing (two-CTA picker + everything filterable)
	//   - /<slug>/appointments   appointments-only flow
	//   - /<slug>/classes        classes-only flow (date-first listing)
	const BOOK_HOST = 'https://book.avoqado.io'
	const publicBookingUrl = `${BOOK_HOST}/${slug}`
	const appointmentsUrl = `${BOOK_HOST}/${slug}/appointments`
	const classesUrl = `${BOOK_HOST}/${slug}/classes`

	const cdnUrl = 'https://cdn.avoqado.io/widget.js'
	const embedUrl = `https://cdn.avoqado.io/embed?venue=${slug}&locale=${locale}&theme=${theme}&mode=inline`
	const previewUrl = venueSlug ? publicBookingUrl : null
	const venueName = venue?.name ?? 'tu negocio'

	// Fetch products to compute per-channel counts (services vs classes).
	// Cheap because it's the same endpoint used elsewhere in the dashboard.
	const venueId = venue?.id
	const { data: products } = useQuery({
		queryKey: ['products', venueId, 'all'],
		queryFn: () => getProducts(venueId!),
		enabled: !!venueId,
		staleTime: 60_000,
	})

	const { appointmentCount, classCount } = useMemo(() => {
		const list = products ?? []
		const isActive = (p: { active?: boolean }) => p.active !== false
		const appt = list.filter(p => isActive(p) && (p.type === 'APPOINTMENTS_SERVICE' || p.type === 'SERVICE')).length
		const klass = list.filter(p => isActive(p) && p.type === 'CLASS').length
		return { appointmentCount: appt, classCount: klass }
	}, [products])

	const htmlSnippet = `<!-- Avoqado Booking Widget -->
<script src="${cdnUrl}" defer></script>
<avoqado-booking
  venue="${slug}"
  locale="${locale}"
  theme="${theme}"
  mode="${mode}"
></avoqado-booking>`

	const iframeSnippet = `<iframe src="${embedUrl}"
        style="width:100%;border:0;min-height:850px;display:block"
        title="Reservar"
        loading="lazy"
        allow="payment"></iframe>`

	const linkSnippet = `<div style="text-align:center;padding:48px 16px;background:#f7f7f8;border-radius:12px;margin:24px 0">
  <p style="color:#6b7280;margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Reserva tu visita</p>
  <h3 style="color:#0f0f10;font-family:inherit;margin:0 0 20px;font-size:22px;font-weight:600;letter-spacing:-0.01em">Agenda en línea en menos de 1 minuto</h3>
  <a href="${publicBookingUrl}"
     target="_blank"
     rel="noopener"
     style="display:inline-block;background:#0f0f10;color:#fff;padding:16px 48px;border-radius:999px;text-decoration:none;font-weight:600;font-size:16px;letter-spacing:0.2px">
    Reservar ahora →
  </a>
</div>`

	const directLinkSnippet = `<a href="${publicBookingUrl}" target="_blank" rel="noopener">Reservar en ${venueName}</a>`

	const wordpressShortcode = `[avoqado_booking venue="${slug}" locale="${locale}" theme="${theme}" mode="${mode}"]`

	const npmSnippet = `# Install
npm install @avoqado/booking-widget

# Import in your app
import '@avoqado/booking-widget'

# Use in JSX / HTML
<avoqado-booking venue="${slug}" locale="${locale}" theme="${theme}"></avoqado-booking>`

	return (
		<div className="space-y-6">
			<PageTitleWithInfo
				title={t('onlineBooking.title')}
				className="text-2xl font-bold"
			/>
			<p className="text-muted-foreground">{t('onlineBooking.subtitle')}</p>

			{/* Booking channels — Square-style separation. Each channel is a shareable URL. */}
			<div className="space-y-4">
				<h2 className="text-base font-semibold">Páginas de reserva públicas</h2>
				<p className="-mt-2 text-sm text-muted-foreground">
					Comparte estos enlaces con tus clientes. Cada uno abre un flujo distinto de reserva.
				</p>

				{/* Citas channel */}
				<Card>
					<CardHeader>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div className="flex items-start gap-3">
								<div className="rounded-md bg-emerald-100 p-2 dark:bg-emerald-900/40">
									<CalendarIcon className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
								</div>
								<div className="space-y-0.5">
									<CardTitle className="text-base">Página de reserva de citas</CardTitle>
									<CardDescription>
										{appointmentCount === 0
											? 'No tienes servicios configurados todavía.'
											: appointmentCount === 1
												? '1 servicio'
												: `${appointmentCount} servicios`}
									</CardDescription>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Button variant="ghost" size="sm" asChild>
									<Link to={`${fullBasePath}/menu`}>Editar servicios</Link>
								</Button>
								<Button variant="outline" size="sm" asChild>
									<a href={appointmentsUrl} target="_blank" rel="noopener noreferrer">
										Mostrar
										<ExternalLink className="ml-2 h-3.5 w-3.5" />
									</a>
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<CodeBlock code={appointmentsUrl} />
					</CardContent>
				</Card>

				{/* Clases channel */}
				<Card>
					<CardHeader>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div className="flex items-start gap-3">
								<div className="rounded-md bg-violet-100 p-2 dark:bg-violet-900/40">
									<UsersIcon className="h-5 w-5 text-violet-700 dark:text-violet-300" />
								</div>
								<div className="space-y-0.5">
									<CardTitle className="text-base">Página de reserva de clases</CardTitle>
									<CardDescription>
										{classCount === 0
											? 'No tienes clases configuradas todavía.'
											: classCount === 1
												? '1 clase'
												: `${classCount} clases`}
									</CardDescription>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Button variant="ghost" size="sm" asChild>
									<Link to={`${fullBasePath}/reservations/calendar`}>Ver calendario</Link>
								</Button>
								<Button variant="outline" size="sm" asChild>
									<a href={classesUrl} target="_blank" rel="noopener noreferrer">
										Mostrar
										<ExternalLink className="ml-2 h-3.5 w-3.5" />
									</a>
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<CodeBlock code={classesUrl} />
					</CardContent>
				</Card>

				{/* Unified channel — fallback for venues that don't differentiate */}
				<Card className="border-dashed">
					<CardHeader>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div className="flex items-start gap-3">
								<div className="rounded-md bg-muted p-2">
									<Globe className="h-5 w-5 text-muted-foreground" />
								</div>
								<div className="space-y-0.5">
									<CardTitle className="text-base">Página unificada</CardTitle>
									<CardDescription>Todos los servicios y clases en un solo enlace.</CardDescription>
								</div>
							</div>
							<Button variant="outline" size="sm" asChild>
								<a href={publicBookingUrl} target="_blank" rel="noopener noreferrer">
									Mostrar
									<ExternalLink className="ml-2 h-3.5 w-3.5" />
								</a>
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						<CodeBlock code={publicBookingUrl} />
					</CardContent>
				</Card>
			</div>

			{/* Settings link */}
			<Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
				<CardContent className="flex items-center justify-between py-4">
					<div className="flex items-center gap-3">
						<Settings className="h-5 w-5 text-blue-600" />
						<div>
							<p className="font-medium">{t('onlineBooking.settingsLink')}</p>
							<p className="text-sm text-muted-foreground">{t('onlineBooking.settingsLinkDescription')}</p>
						</div>
					</div>
					<Button variant="outline" size="sm" asChild>
						<Link to={`${fullBasePath}/reservations/settings`}>
							{t('onlineBooking.goToSettings')}
							<ExternalLink className="ml-2 h-3.5 w-3.5" />
						</Link>
					</Button>
				</CardContent>
			</Card>

			{/* Decision flow / Which snippet to use */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">{t('onlineBooking.whichSnippet')}</CardTitle>
					<CardDescription>{t('onlineBooking.whichSnippetDescription')}</CardDescription>
				</CardHeader>
				<CardContent>
					<ol className="space-y-3 text-sm">
						<li className="flex gap-3">
							<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">1</span>
							<div>
								<p className="font-medium">{t('onlineBooking.flowStep1Title')}</p>
								<p className="text-muted-foreground">{t('onlineBooking.flowStep1Description')}</p>
							</div>
						</li>
						<li className="flex gap-3">
							<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">2</span>
							<div>
								<p className="font-medium">{t('onlineBooking.flowStep2Title')}</p>
								<p className="text-muted-foreground">{t('onlineBooking.flowStep2Description')}</p>
							</div>
						</li>
						<li className="flex gap-3">
							<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">3</span>
							<div>
								<p className="font-medium">{t('onlineBooking.flowStep3Title')}</p>
								<p className="text-muted-foreground">{t('onlineBooking.flowStep3Description')}</p>
							</div>
						</li>
					</ol>
				</CardContent>
			</Card>

			{/* Snippet customizer */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Code2 className="h-5 w-5" />
						{t('onlineBooking.customize')}
					</CardTitle>
					<CardDescription>{t('onlineBooking.customizeDescription')}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						{/* Locale */}
						<div className="space-y-2">
							<Label>{t('onlineBooking.fields.locale')}</Label>
							<Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="es">{t('onlineBooking.locales.es')}</SelectItem>
									<SelectItem value="en">{t('onlineBooking.locales.en')}</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* Theme */}
						<div className="space-y-2">
							<Label>{t('onlineBooking.fields.theme')}</Label>
							<Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="auto">{t('onlineBooking.themes.auto')}</SelectItem>
									<SelectItem value="light">{t('onlineBooking.themes.light')}</SelectItem>
									<SelectItem value="dark">{t('onlineBooking.themes.dark')}</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* Mode */}
						<div className="space-y-2">
							<Label>{t('onlineBooking.fields.mode')}</Label>
							<Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="inline">{t('onlineBooking.modes.inline')}</SelectItem>
									<SelectItem value="button">{t('onlineBooking.modes.button')}</SelectItem>
									<SelectItem value="popup">{t('onlineBooking.modes.popup')}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* HTML embed code — recommended for most sites */}
			<Card>
				<CardHeader>
					<div className="flex items-start justify-between gap-3">
						<div>
							<CardTitle className="flex items-center gap-2 text-base">
								<Code2 className="h-4 w-4" />
								{t('onlineBooking.htmlEmbed')}
							</CardTitle>
							<CardDescription>{t('onlineBooking.htmlEmbedDescription')}</CardDescription>
						</div>
						<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
							{t('onlineBooking.recommended')}
						</span>
					</div>
				</CardHeader>
				<CardContent>
					<CodeBlock code={htmlSnippet} />
				</CardContent>
			</Card>

			{/* WordPress */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">{t('onlineBooking.wordpress')}</CardTitle>
					<CardDescription>{t('onlineBooking.wordpressDescription')}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<CodeBlock code={wordpressShortcode} />
					<p className="text-sm text-muted-foreground">{t('onlineBooking.wordpressPluginNote')}</p>
				</CardContent>
			</Card>

			{/* Iframe — for sites that block scripts but allow iframe */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<Frame className="h-4 w-4" />
						{t('onlineBooking.iframe')}
					</CardTitle>
					<CardDescription>{t('onlineBooking.iframeDescription')}</CardDescription>
				</CardHeader>
				<CardContent>
					<CodeBlock code={iframeSnippet} />
				</CardContent>
			</Card>

			{/* Link button — for hardcore restricted sites (BUQ, GoDaddy Managed, etc.) */}
			<Card className="border-amber-200 dark:border-amber-900/50">
				<CardHeader>
					<div className="flex items-start gap-3">
						<ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
						<div className="space-y-1">
							<CardTitle className="flex items-center gap-2 text-base">
								<MousePointerClick className="h-4 w-4" />
								{t('onlineBooking.linkButton')}
							</CardTitle>
							<CardDescription>{t('onlineBooking.linkButtonDescription')}</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					<CodeBlock code={linkSnippet} />
					<p className="text-xs text-muted-foreground">{t('onlineBooking.linkButtonNote')}</p>
				</CardContent>
			</Card>

			{/* npm */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">{t('onlineBooking.npm')}</CardTitle>
					<CardDescription>{t('onlineBooking.npmDescription')}</CardDescription>
				</CardHeader>
				<CardContent>
					<CodeBlock code={npmSnippet} />
				</CardContent>
			</Card>

			{/* Live preview */}
			{previewUrl && (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2 text-base">
									<Globe className="h-4 w-4" />
									{t('onlineBooking.preview')}
								</CardTitle>
								<CardDescription>{t('onlineBooking.previewDescription')}</CardDescription>
							</div>
							<Button variant="outline" size="sm" asChild>
								<a href={previewUrl} target="_blank" rel="noopener noreferrer">
									{t('onlineBooking.openPreview')}
									<ExternalLink className="ml-2 h-3.5 w-3.5" />
								</a>
							</Button>
						</div>
					</CardHeader>
					<CardContent className="p-0">
						<iframe
							src={previewUrl}
							title={t('onlineBooking.preview')}
							className="h-[800px] w-full rounded-b-lg border-t border-border"
							loading="lazy"
							allow="payment"
						/>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
