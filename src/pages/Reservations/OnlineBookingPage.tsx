import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Copy, Check, ExternalLink, Code2, Globe, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useCurrentVenue } from '@/hooks/use-current-venue'

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
	const cdnUrl = 'https://cdn.avoqado.io/widget.js'
	const previewUrl = venueSlug ? `/book/${venueSlug}` : null

	const htmlSnippet = `<!-- Avoqado Booking Widget -->
<script src="${cdnUrl}" defer></script>
<avoqado-booking
  venue="${slug}"
  locale="${locale}"
  theme="${theme}"
  mode="${mode}"
></avoqado-booking>`

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

			{/* HTML embed code */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">{t('onlineBooking.htmlEmbed')}</CardTitle>
					<CardDescription>{t('onlineBooking.htmlEmbedDescription')}</CardDescription>
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
							className="h-[600px] w-full rounded-b-lg border-t border-border"
							sandbox="allow-scripts allow-same-origin allow-forms"
						/>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
