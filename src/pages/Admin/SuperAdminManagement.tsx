import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  Key,
  Lock,
  PlusCircle,
  Search,
  ShieldAlert,
  User,
  UserCog,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// Mock data for super admins
const mockSuperAdmins = [
  {
    id: '1',
    name: 'Carlos Rodríguez',
    email: 'carlos@example.com',
    status: 'active',
    lastLogin: '2023-06-25T14:32:21Z',
    createdAt: '2022-01-15T10:00:00Z',
    permissions: ['all'],
    isMaster: true,
  },
  {
    id: '2',
    name: 'Ana Gómez',
    email: 'ana@example.com',
    status: 'active',
    lastLogin: '2023-06-28T09:15:43Z',
    createdAt: '2022-02-20T11:30:00Z',
    permissions: ['all'],
    isMaster: false,
  },
  {
    id: '3',
    name: 'Roberto Fernández',
    email: 'roberto@example.com',
    status: 'inactive',
    lastLogin: '2023-05-10T16:45:12Z',
    createdAt: '2022-03-10T09:45:00Z',
    permissions: ['users', 'venues', 'config'],
    isMaster: false,
  },
  {
    id: '4',
    name: 'María López',
    email: 'maria@example.com',
    status: 'active',
    lastLogin: '2023-06-29T11:22:33Z',
    createdAt: '2022-04-05T14:20:00Z',
    permissions: ['users', 'venues', 'reports'],
    isMaster: false,
  },
]

// Mock audit log data
const mockAuditLogs = [
  {
    id: '1',
    timestamp: '2023-06-29T15:32:10Z',
    action: 'user_update',
    adminId: '1',
    adminName: 'Carlos Rodríguez',
    details: 'Updated user role for user ID: 42 from USER to ADMIN',
    ip: '192.168.1.105',
  },
  {
    id: '2',
    timestamp: '2023-06-29T14:15:22Z',
    action: 'venue_create',
    adminId: '2',
    adminName: 'Ana Gómez',
    details: 'Created new venue: Restaurante Madrid Centro',
    ip: '192.168.1.110',
  },
  {
    id: '3',
    timestamp: '2023-06-28T10:45:33Z',
    action: 'superadmin_login',
    adminId: '1',
    adminName: 'Carlos Rodríguez',
    details: 'Superadmin login from new IP address',
    ip: '192.168.1.105',
  },
  {
    id: '4',
    timestamp: '2023-06-28T09:12:45Z',
    action: 'config_update',
    adminId: '2',
    adminName: 'Ana Gómez',
    details: 'Updated system security settings',
    ip: '192.168.1.110',
  },
  {
    id: '5',
    timestamp: '2023-06-27T16:30:21Z',
    action: 'superadmin_create',
    adminId: '1',
    adminName: 'Carlos Rodríguez',
    details: 'Created new superadmin account: María López',
    ip: '192.168.1.105',
  },
  {
    id: '6',
    timestamp: '2023-06-27T11:05:12Z',
    action: 'user_delete',
    adminId: '4',
    adminName: 'María López',
    details: 'Deleted user ID: 51',
    ip: '192.168.1.120',
  },
  {
    id: '7',
    timestamp: '2023-06-26T14:22:33Z',
    action: 'venue_update',
    adminId: '2',
    adminName: 'Ana Gómez',
    details: 'Updated venue settings for: Bar Sevilla',
    ip: '192.168.1.110',
  },
]

export default function SuperAdminManagement() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { user } = useAuth()
  const [superAdmins, setSuperAdmins] = useState(mockSuperAdmins)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('admins')
  const [selectedAdmin, setSelectedAdmin] = useState(null)
  const [auditLogs, setAuditLogs] = useState(mockAuditLogs)
  const [actionFilter, setActionFilter] = useState('')
  const isSuperAdmin = user?.role === 'SUPERADMIN'

  // Filter superadmins based on search
  const filteredSuperAdmins = superAdmins.filter(admin => {
    return admin.name.toLowerCase().includes(searchTerm.toLowerCase()) || admin.email.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Filter audit logs based on action type
  const filteredAuditLogs = auditLogs.filter(log => {
    return actionFilter ? log.action === actionFilter : true
  })

  // Handle status toggle
  const handleStatusToggle = adminId => {
    setSuperAdmins(
      superAdmins.map(admin =>
        admin.id === adminId
          ? {
              ...admin,
              status: admin.status === 'active' ? 'inactive' : 'active',
            }
          : admin,
      ),
    )

    const newStatus = superAdmins.find(a => a.id === adminId)?.status === 'active' ? 'inactive' : 'active'

    toast({
      title: t(newStatus === 'active' ? 'admin.superAdminManagement.toast.activated' : 'admin.superAdminManagement.toast.deactivated'),
      description: t(newStatus === 'active' ? 'admin.superAdminManagement.toast.activatedDesc' : 'admin.superAdminManagement.toast.deactivatedDesc'),
    })
  }

  // Create new super admin
  const handleCreateSuperAdmin = data => {
    // In a real implementation, this would send a request to the server
    toast({
      title: t('admin.superAdminManagement.toast.created'),
      description: t('admin.superAdminManagement.toast.createdDesc'),
    })
  }

  // View admin details
  const handleViewAdminDetails = admin => {
    setSelectedAdmin(admin)
  }

  // Reset 2FA
  const handleReset2FA = adminId => {
    toast({
      title: t('admin.superAdminManagement.toast.reset2FA'),
      description: t('admin.superAdminManagement.toast.reset2FADesc'),
    })
  }

  // Format date
  const formatDate = dateString => {
    return new Date(dateString).toLocaleString()
  }

  // Get permission label
  const getPermissionLabel = permission => {
    const labels = {
      all: t('admin.superAdminManagement.permissions.all'),
      users: t('admin.superAdminManagement.permissions.users'),
      venues: t('admin.superAdminManagement.permissions.venues'),
      config: t('admin.superAdminManagement.permissions.config'),
      reports: t('admin.superAdminManagement.permissions.reports'),
    }
    return labels[permission] || permission
  }

  // Get audit action label and icon
  const getAuditInfo = action => {
    const actionMap = {
      user_update: { label: t('admin.superAdminManagement.audit.actions.userUpdate'), icon: <User className="h-4 w-4 text-blue-600" /> },
      user_create: { label: t('admin.superAdminManagement.audit.actions.userCreate'), icon: <UserPlus className="h-4 w-4 text-green-600" /> },
      user_delete: { label: t('admin.superAdminManagement.audit.actions.userDelete'), icon: <XCircle className="h-4 w-4 text-destructive" /> },
      venue_create: { label: t('admin.superAdminManagement.audit.actions.venueCreate'), icon: <PlusCircle className="h-4 w-4 text-green-600" /> },
      venue_update: { label: t('admin.superAdminManagement.audit.actions.venueUpdate'), icon: <UserCog className="h-4 w-4 text-blue-600" /> },
      config_update: { label: t('admin.superAdminManagement.audit.actions.configUpdate'), icon: <Key className="h-4 w-4 text-amber-500" /> },
      superadmin_create: { label: t('admin.superAdminManagement.audit.actions.superadminCreate'), icon: <ShieldAlert className="h-4 w-4 text-purple-500" /> },
      superadmin_login: { label: t('admin.superAdminManagement.audit.actions.superadminLogin'), icon: <Lock className="h-4 w-4 text-muted-foreground" /> },
    }

    return actionMap[action] || { label: action, icon: <Eye className="h-4 w-4 text-muted-foreground" /> }
  }

  if (!isSuperAdmin) {
    return (
      <div className="py-4">
        <Card className="border border-red-500/30">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold">{t('admin.superAdminManagement.accessDenied.title')}</h3>
                <p className="text-muted-foreground">{t('admin.superAdminManagement.accessDenied.description')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('admin.superAdminManagement.title')}</h2>
        <p className="text-muted-foreground">{t('admin.superAdminManagement.subtitle')}</p>
      </div>

      {/* Warning banner */}
      <div className="bg-amber-500/10 border-l-4 border-amber-500/30 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-foreground">
              {t('admin.superAdminManagement.warningMessage')}
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="admins" className="flex items-center">
            <ShieldAlert className="h-4 w-4 mr-2" />
            <span>{t('admin.superAdminManagement.tabs.admins')}</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center">
            <Eye className="h-4 w-4 mr-2" />
            <span>{t('admin.superAdminManagement.tabs.audit')}</span>
          </TabsTrigger>
        </TabsList>

        {/* SuperAdmins Tab */}
        <TabsContent value="admins" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={t('admin.superAdminManagement.searchPlaceholder')}
                  className="pl-8 w-[250px]"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  {t('admin.superAdminManagement.newSuperAdmin')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('admin.superAdminManagement.dialog.create.title')}</DialogTitle>
                  <DialogDescription>
                    {t('admin.superAdminManagement.dialog.create.description')}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="name" className="text-right">
                      {t('admin.superAdminManagement.dialog.create.name')}
                    </label>
                    <Input id="name" className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="email" className="text-right">
                      {t('admin.superAdminManagement.dialog.create.email')}
                    </label>
                    <Input id="email" type="email" className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="password" className="text-right">
                      {t('admin.superAdminManagement.dialog.create.password')}
                    </label>
                    <Input id="password" type="password" className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="confirm" className="text-right">
                      {t('admin.superAdminManagement.dialog.create.confirm')}
                    </label>
                    <Input id="confirm" type="password" className="col-span-3" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateSuperAdmin}>{t('admin.superAdminManagement.dialog.create.button')}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.superAdminManagement.table.administrator')}</TableHead>
                    <TableHead>{t('admin.superAdminManagement.table.status')}</TableHead>
                    <TableHead>{t('admin.superAdminManagement.table.lastAccess')}</TableHead>
                    <TableHead>{t('admin.superAdminManagement.table.permissions')}</TableHead>
                    <TableHead className="text-right">{t('admin.superAdminManagement.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuperAdmins.length > 0 ? (
                    filteredSuperAdmins.map(admin => (
                      <TableRow key={admin.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center">
                              {admin.name}
                              {admin.isMaster && <Badge className="ml-2 bg-purple-600">{t('admin.superAdminManagement.table.master')}</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">{admin.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {admin.status === 'active' ? (
                              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="mr-2 h-4 w-4 text-destructive" />
                            )}
                            {admin.status === 'active' ? t('admin.superAdminManagement.table.active') : t('admin.superAdminManagement.table.inactive')}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(admin.lastLogin)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {admin.permissions.includes('all') ? (
                              <Badge variant="outline">{t('admin.superAdminManagement.permissions.all')}</Badge>
                            ) : (
                              admin.permissions.map(perm => (
                                <Badge key={perm} variant="outline">
                                  {getPermissionLabel(perm)}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {!admin.isMaster && (
                              <Button variant="outline" size="sm" onClick={() => handleStatusToggle(admin.id)}>
                                {admin.status === 'active' ? t('admin.superAdminManagement.table.deactivate') : t('admin.superAdminManagement.table.activate')}
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => handleViewAdminDetails(admin)}>
                              {t('admin.superAdminManagement.table.details')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        {t('admin.superAdminManagement.table.noResults')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {selectedAdmin && (
            <Dialog open={!!selectedAdmin} onOpenChange={open => !open && setSelectedAdmin(null)}>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>{t('admin.superAdminManagement.dialog.details.title')}</DialogTitle>
                  <DialogDescription>{t('admin.superAdminManagement.dialog.details.description')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">{selectedAdmin.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedAdmin.email}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium">{t('admin.superAdminManagement.dialog.details.status')}</h4>
                      <div className="flex items-center mt-1">
                        {selectedAdmin.status === 'active' ? (
                          <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="mr-2 h-4 w-4 text-destructive" />
                        )}
                        {selectedAdmin.status === 'active' ? t('admin.superAdminManagement.table.active') : t('admin.superAdminManagement.table.inactive')}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">{t('admin.superAdminManagement.dialog.details.created')}</h4>
                      <div className="text-sm mt-1">{formatDate(selectedAdmin.createdAt)}</div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">{t('admin.superAdminManagement.dialog.details.lastAccess')}</h4>
                      <div className="text-sm mt-1">{formatDate(selectedAdmin.lastLogin)}</div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">{t('admin.superAdminManagement.dialog.details.type')}</h4>
                      <div className="text-sm mt-1 flex items-center">
                        {selectedAdmin.isMaster ? (
                          <>
                            <ShieldAlert className="mr-2 h-4 w-4 text-purple-500" />
                            {t('admin.superAdminManagement.dialog.details.masterSuperAdmin')}
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="mr-2 h-4 w-4 text-blue-600" />
                            {t('admin.superAdminManagement.dialog.details.superAdmin')}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">{t('admin.superAdminManagement.dialog.details.permissions')}</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedAdmin.permissions.includes('all') ? (
                        <Badge className="bg-purple-600">{t('admin.superAdminManagement.permissions.all')}</Badge>
                      ) : (
                        selectedAdmin.permissions.map(perm => <Badge key={perm}>{getPermissionLabel(perm)}</Badge>)
                      )}
                    </div>
                  </div>

                  {!selectedAdmin.isMaster && (
                    <div className="border-t pt-4 flex flex-col space-y-2">
                      <h4 className="text-sm font-medium mb-2">{t('admin.superAdminManagement.dialog.details.securityActions')}</h4>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Key className="mr-2 h-4 w-4" />
                            {t('admin.superAdminManagement.dialog.details.reset2FA')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('admin.superAdminManagement.dialog.details.reset2FATitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('admin.superAdminManagement.dialog.details.reset2FADescription')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('admin.superAdminManagement.dialog.details.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleReset2FA(selectedAdmin.id)}>{t('admin.superAdminManagement.dialog.details.reset')}</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <Button variant="outline" size="sm">
                        <Lock className="mr-2 h-4 w-4" />
                        {t('admin.superAdminManagement.dialog.details.changePassword')}
                      </Button>

                      <div className="flex items-center justify-between mt-2">
                        <div>
                          <label className="text-sm font-medium">{t('admin.superAdminManagement.dialog.details.requirePasswordChange')}</label>
                          <p className="text-xs text-muted-foreground">{t('admin.superAdminManagement.dialog.details.requirePasswordChangeDesc')}</p>
                        </div>
                        <Switch defaultChecked={false} />
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedAdmin(null)}>
                    {t('admin.superAdminManagement.dialog.details.close')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t('admin.superAdminManagement.audit.filterPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('admin.superAdminManagement.audit.allActions')}</SelectItem>
                  <SelectItem value="user_update">{t('admin.superAdminManagement.audit.actions.userUpdate')}</SelectItem>
                  <SelectItem value="user_create">{t('admin.superAdminManagement.audit.actions.userCreate')}</SelectItem>
                  <SelectItem value="user_delete">{t('admin.superAdminManagement.audit.actions.userDelete')}</SelectItem>
                  <SelectItem value="venue_create">{t('admin.superAdminManagement.audit.actions.venueCreate')}</SelectItem>
                  <SelectItem value="venue_update">{t('admin.superAdminManagement.audit.actions.venueUpdate')}</SelectItem>
                  <SelectItem value="config_update">{t('admin.superAdminManagement.audit.actions.configUpdate')}</SelectItem>
                  <SelectItem value="superadmin_create">{t('admin.superAdminManagement.audit.actions.superadminCreate')}</SelectItem>
                  <SelectItem value="superadmin_login">{t('admin.superAdminManagement.audit.actions.superadminLogin')}</SelectItem>
                </SelectContent>
              </Select>
              {actionFilter && (
                <Button variant="ghost" size="icon" onClick={() => setActionFilter('')} className="h-10 w-10">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Button variant="outline">
              <PlusCircle className="h-4 w-4 mr-2" />
              {t('admin.superAdminManagement.audit.exportRecords')}
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.superAdminManagement.audit.table.dateTime')}</TableHead>
                    <TableHead>{t('admin.superAdminManagement.audit.table.action')}</TableHead>
                    <TableHead>{t('admin.superAdminManagement.audit.table.administrator')}</TableHead>
                    <TableHead>{t('admin.superAdminManagement.audit.table.details')}</TableHead>
                    <TableHead>{t('admin.superAdminManagement.audit.table.ip')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAuditLogs.length > 0 ? (
                    filteredAuditLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(log.timestamp)}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {getAuditInfo(log.action).icon}
                            <span className="ml-2">{getAuditInfo(log.action).label}</span>
                          </div>
                        </TableCell>
                        <TableCell>{log.adminName}</TableCell>
                        <TableCell className="max-w-xs truncate" title={log.details}>
                          {log.details}
                        </TableCell>
                        <TableCell>{log.ip}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        {t('admin.superAdminManagement.audit.table.noResults')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground text-right">
            {t('admin.superAdminManagement.audit.showing', { filtered: filteredAuditLogs.length, total: auditLogs.length })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
