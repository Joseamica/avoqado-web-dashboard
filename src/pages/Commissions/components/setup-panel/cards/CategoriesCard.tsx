import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { CommissionSetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'
import { isCardValid, isCardTouched } from '../useSetupReducer'
import SetupCard from '../SetupCard'
import CategoryFilter from '../../wizard/CategoryFilter'

interface CategoriesCardProps {
  state: CommissionSetupState
  dispatch: (action: SetupAction) => void
}

export default function CategoriesCard({ state, dispatch }: CategoriesCardProps) {
  const { t } = useTranslation('commissions')
  const [open, setOpen] = useState(false)

  const isValid = isCardValid(state, 'categories')
  const { filterEnabled, categoryIds } = state.categories

  const description = filterEnabled
    ? categoryIds.length > 0
      ? t('setup.categories.selectedCount', { count: categoryIds.length })
      : t('setup.categories.noneSelected')
    : t('setup.categories.allCategories')

  return (
    <>
      <SetupCard
        icon={LayoutGrid}
        title={t('setup.categories.title')}
        description={description}
        isValid={isValid}
        touched={isCardTouched(state, 'categories')}
        onClick={() => setOpen(true)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('setup.categories.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">{t('setup.categories.filterLabel')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('setup.categories.filterDesc')}
                </p>
              </div>
              <Switch
                checked={filterEnabled}
                onCheckedChange={checked => {
                  dispatch({
                    type: 'SET_CATEGORIES',
                    data: {
                      filterEnabled: checked,
                      ...(checked ? {} : { categoryIds: [] }),
                    },
                  })
                }}
              />
            </div>

            {filterEnabled && (
              <CategoryFilter
                categoryIds={categoryIds}
                onChange={ids =>
                  dispatch({ type: 'SET_CATEGORIES', data: { categoryIds: ids } })
                }
              />
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setOpen(false)}>{t('actions.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
