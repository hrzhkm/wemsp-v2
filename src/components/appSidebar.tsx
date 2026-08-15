import { Link, useLocation, useRouter } from '@tanstack/react-router'
import { ChevronUp, User } from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth/authClient'
import { useLanguage } from '@/lib/i18n/context'
import { getVisibleNavItems } from '@/components/appNavItems'
import { getRoleFromSession } from '@/lib/auth/rbac'

export function AppSidebar() {
  const router = useRouter()
  const location = useLocation()
  const { t } = useLanguage()

  const { data: session } = authClient.useSession()

  const user = session?.user

  const role = getRoleFromSession(session)
  const visibleItems = getVisibleNavItems(role)
  const navigationItems = visibleItems.filter(
    (i) => i.section === 'application',
  )
  const accountItems = visibleItems.filter((i) => i.section === 'account')
  const administrationItems = visibleItems.filter(
    (i) => i.section === 'administration',
  )

  const activeMatchPath = visibleItems
    .filter(
      (item) =>
        location.pathname === item.matchPath ||
        location.pathname.startsWith(`${item.matchPath}/`),
    )
    .reduce<
      string | null
    >((best, item) => (!best || item.matchPath.length > best.length ? item.matchPath : best), null)

  const isActivePath = (matchPath: string) => matchPath === activeMatchPath

  const handleLogout = async () => {
    await authClient.signOut()
    router.navigate({ to: '/' })
  }

  return (
    <Sidebar className="border-r border-sidebar-border/60">
      <SidebarHeader className="p-2.5 pb-1.5">
        <div className="rounded-xl border border-sidebar-border/60 bg-gradient-to-br from-sidebar-accent/60 via-sidebar to-sidebar p-2 shadow-sm">
          <Link to="/app/dashboard" className="flex items-center gap-2.5">
            <div className="rounded-lg bg-white/90 p-1.5 shadow-sm ring-1 ring-black/5">
              <img src="/assets/logo2.png" alt="WEMSP" className="h-6 w-auto" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-tight">
                WEMSP
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/70">
                {t('navigation.estateManagement')}
              </p>
            </div>
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 pb-2">
        <SidebarGroup className="pt-1">
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/60">
            {t('navigation.application')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActivePath(item.matchPath)}
                    className="h-8 rounded-md px-2 text-sidebar-foreground/70 data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                  >
                    <Link
                      to={item.to}
                      {...(item.to === '/app/profile'
                        ? {
                            search: {
                              onboarding: false,
                              redirect: location.pathname,
                            },
                          }
                        : {})}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="text-xs">{t(item.labelKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarSeparator className="my-1" />
              {accountItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActivePath(item.matchPath)}
                    className="h-8 rounded-md px-2 text-sidebar-foreground/70 data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                  >
                    <Link
                      to={item.to}
                      {...(item.to === '/app/profile'
                        ? {
                            search: {
                              onboarding: false,
                              redirect: location.pathname,
                            },
                          }
                        : {})}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="text-xs">{t(item.labelKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {administrationItems.length > 0 && (
                <>
                  <SidebarSeparator className="my-1" />
                  <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/60">
                    {t('navigation.administration')}
                  </SidebarGroupLabel>
                  {administrationItems.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActivePath(item.matchPath)}
                        className="h-8 rounded-md px-2 text-sidebar-foreground/70 data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                      >
                        <Link to={item.to}>
                          <item.icon className="size-4 shrink-0" />
                          <span className="text-xs">{t(item.labelKey)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/60 p-2">
        <SidebarMenu className="gap-0">
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-9 rounded-md px-2 hover:bg-sidebar-accent/60">
                  <div className="flex size-6 items-center justify-center rounded-full bg-sidebar-primary/15 text-sidebar-primary">
                    <User className="size-3.5" />
                  </div>
                  <span className="truncate text-xs">
                    {user?.name || user?.email || t('navigation.account')}
                  </span>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem
                  onClick={() =>
                    router.navigate({
                      to: '/app/profile',
                      search: { onboarding: false, redirect: undefined },
                    })
                  }
                >
                  <span>{t('navigation.profile')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <span>{t('navigation.signOut')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
