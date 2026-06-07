import { Link, useLocation, useRouter } from "@tanstack/react-router"
import { ChevronUp, User } from "lucide-react"

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
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"
import { useLanguage } from "@/lib/i18n/context"
import { getVisibleNavItems } from "@/components/app-nav-items"
import { getRoleFromSession } from "@/lib/rbac"

export function AppSidebar() {
  const router = useRouter()
  const location = useLocation()
  const { t } = useLanguage()

  const { data: session } = authClient.useSession()

  const user = session?.user

  const role = getRoleFromSession(session)
  const visibleItems = getVisibleNavItems(role)
  const navigationItems = visibleItems.filter((i) => i.section === "application")
  const accountItems = visibleItems.filter((i) => i.section === "account")
  const administrationItems = visibleItems.filter((i) => i.section === "administration")

  const isActivePath = (matchPath: string) =>
    location.pathname === matchPath || location.pathname.startsWith(`${matchPath}/`)

  const handleLogout = async () => {
    await authClient.signOut()
    router.navigate({ to: "/" })
  }

  return (
    <Sidebar className="border-r border-sidebar-border/60">
      <SidebarHeader className="p-4 pb-2">
        <div className="rounded-2xl border border-sidebar-border/60 bg-gradient-to-br from-sidebar-accent/60 via-sidebar to-sidebar p-3 shadow-sm">
          <Link to="/app/dashboard" className="flex items-center gap-3">
            <div className="rounded-xl bg-white/90 p-2 shadow-sm ring-1 ring-black/5">
              <img src="/assets/logo2.png" alt="WEMSP" className="h-8 w-auto" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">WEMSP</p>
              <p className="truncate text-xs text-sidebar-foreground/70">{t('navigation.estateManagement')}</p>
            </div>
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 pb-3">
        <SidebarGroup className="pt-1">
          <SidebarGroupLabel className="px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/60">
            {t('navigation.application')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActivePath(item.matchPath)}
                    className="h-11 rounded-xl px-3 data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-sm"
                  >
                    <Link
                      to={item.to}
                      {...(item.to === "/app/profile"
                        ? { search: { onboarding: false, redirect: location.pathname } }
                        : {})}
                    >
                      <div className="flex size-7 items-center justify-center rounded-lg bg-sidebar-accent/70">
                        <item.icon className="size-4" />
                      </div>
                      <span className="font-medium">{t(item.labelKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarSeparator className="my-2" />
              {accountItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActivePath(item.matchPath)}
                    className="h-11 rounded-xl px-3 data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-sm"
                  >
                    <Link
                      to={item.to}
                      {...(item.to === "/app/profile"
                        ? { search: { onboarding: false, redirect: location.pathname } }
                        : {})}
                    >
                      <div className="flex size-7 items-center justify-center rounded-lg bg-sidebar-accent/70">
                        <item.icon className="size-4" />
                      </div>
                      <span className="font-medium">{t(item.labelKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {administrationItems.length > 0 && (
                <>
                  <SidebarSeparator className="my-2" />
                  <SidebarGroupLabel className="px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/60">
                    {t('navigation.administration')}
                  </SidebarGroupLabel>
                  {administrationItems.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActivePath(item.matchPath)}
                        className="h-11 rounded-xl px-3 data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-sm"
                      >
                        <Link to={item.to}>
                          <div className="flex size-7 items-center justify-center rounded-lg bg-sidebar-accent/70">
                            <item.icon className="size-4" />
                          </div>
                          <span className="font-medium">{t(item.labelKey)}</span>
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
      <SidebarFooter className="border-t border-sidebar-border/60 p-3 pt-3">
        <SidebarMenu className="gap-0">
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="h-12 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/35 px-3 hover:bg-sidebar-accent/60">
                  <div className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary/15 text-sidebar-primary">
                    <User className="size-4" />
                  </div>
                  <span className="truncate">
                    {user?.name || user?.email || t('navigation.account')}
                  </span>
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem onClick={() => router.navigate({ to: "/app/profile", search: { onboarding: false, redirect: undefined } })}>
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
