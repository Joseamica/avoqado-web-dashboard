import { useTranslation } from 'react-i18next'

export default function Configuration() {
  const { t } = useTranslation()
  return <div>{t('config.title')}</div>
}
