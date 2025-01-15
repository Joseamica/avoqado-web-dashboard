import api from '@/api'
import AlertDialogWrapper from '@/components/alert-dialog'
import { LoadingButton } from '@/components/loading-button'
import MultipleSelector from '@/components/multi-selector'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

export default function CategoryId() {
  const { venueId, categoryId } = useParams()
  const queryClient = useQueryClient()
  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: async () => {
      const response = await api.get(`/v1/dashboard/${venueId}/categories/${categoryId}`)
      return response.data
    },
  })
  const from = (location.state as any)?.from || '/'

  const saveCategory = useMutation({
    mutationFn: async formValues => {
      const response = await api.patch(`/v2/dashboard/${venueId}/categories/${categoryId}`, formValues)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: 'Categoría guardada',
        description: 'Los cambios se han guardado correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['category', categoryId] }) // Refetch product data
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar',
        description: error.message || 'Hubo un problema al guardar los cambios.',
        variant: 'destructive',
      })
    },
  })

  const deleteCategory = useMutation({
    mutationFn: async () => {
      await api.delete(`/v2/dashboard/${venueId}/categories/${categoryId}`)
    },
    onSuccess: () => {
      toast({
        title: 'Categoría eliminada',
        description: 'La categoría se ha eliminado correctamente.',
      })
      navigate(from)
    },
  })

  const form = useForm({})

  function onSubmit(formValues) {
    saveCategory.mutate({
      ...formValues,
    })
  }

  if (isLoading) return <div className="p-4">Loading...</div>

  return (
    <div className="p-4">
      <div className="flex flex-row justify-between">
        <div className="space-x-4 flex-row-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{data.category.name}</span>
        </div>
        <div className="space-x-3 flex-row-center ">
          <AlertDialogWrapper
            triggerTitle="Eliminar"
            title="Eliminar categoría"
            // description="Al eliminar el producto, no podrás recuperarlo."
            message=" ¿Estás seguro de que deseas eliminar esta categoría?"
            rightButtonLabel="Eliminar"
            rightButtonVariant="default"
            onRightButtonClick={() => deleteCategory.mutate()}
          />
          <Button variant="outline">Duplicar</Button>
          <LoadingButton
            disabled={!form.formState.isDirty || saveCategory.isPending}
            loading={saveCategory.isPending}
            onClick={form.handleSubmit(onSubmit)}
            variant="default"
          >
            {saveCategory.isPending ? 'Guardando...' : 'Guardar'}
          </LoadingButton>
        </div>
      </div>
      <Separator marginBottom="4" marginTop="2" />
      <div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="avoqadoMenus"
              defaultValue={data.category.avoqadoMenus.map(avoqadoMenu => ({
                label: avoqadoMenu.name,
                value: avoqadoMenu.id,
                disabled: false,
              }))}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Menús en los que aparececerá la categoría</FormLabel>
                  <FormControl>
                    <MultipleSelector
                      {...field}
                      options={data.avoqadoMenus.map(avoqadoMenu => ({
                        label: avoqadoMenu.name,
                        value: avoqadoMenu.id,
                        disabled: false,
                      }))}
                      hidePlaceholderWhenSelected
                      placeholder="Selecciona los menús"
                      emptyIndicator="No se han encontrado mas menús"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="avoqadoProducts"
              defaultValue={data.category.avoqadoProducts.map(avoqadoProduct => ({
                label: avoqadoProduct.name,
                value: avoqadoProduct.id,
                disabled: false,
              }))}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agregar productos a esta categoría</FormLabel>
                  <FormControl>
                    <MultipleSelector
                      {...field}
                      options={data.avoqadoProducts.map(avoqadoProduct => ({
                        label: avoqadoProduct.name,
                        value: avoqadoProduct.id,
                        disabled: false,
                      }))}
                      hidePlaceholderWhenSelected
                      placeholder="Selecciona los productos"
                      emptyIndicator="No se han encontrado mas productos"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
    </div>
  )
}
