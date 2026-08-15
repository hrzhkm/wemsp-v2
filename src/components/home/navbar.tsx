import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { LoginForm } from '@/components/loginForm'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { authClient } from '@/lib/auth/authClient'
import { useLanguage } from '@/lib/i18n/context'
import { LanguageSwitcher } from '@/components/languageSwitcher'

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { data: session } = authClient.useSession()
  const { t } = useLanguage()

  const scrollToSection = (elementId: string) => {
    setIsMenuOpen(false) // Close mobile menu if open
    const element = document.getElementById(elementId)
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }

  return (
    <nav className="fixed w-full z-50 pt-3">
      {/* Apple Liquid Glass style navbar */}
      <div className="mx-4 lg:mx-8 bg-white/10 backdrop-blur-2xl backdrop-saturate-150 rounded-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-inset ring-white/10">
        <div className="container mx-auto flex justify-between items-center px-6 py-3 relative">
          {/* Logo - breaking out of navbar */}
          <button
            onClick={() => scrollToSection('header')}
            className="absolute -top-3 -left-2 hover:scale-105 transition-transform duration-300"
          >
            <img
              src="/assets/logo2.png"
              alt="WEMSP"
              className="h-20 w-auto drop-shadow-2xl mt-1.5"
            />
          </button>
          {/* Spacer for the logo */}
          <div className="w-20 lg:w-24" />

          {/* Mobile menu button */}
          <button
            className="lg:hidden text-white/90 focus:outline-none p-2 hover:bg-white/20 active:bg-white/30 rounded-xl transition-all duration-200"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Desktop menu */}
          <div className="hidden lg:flex items-center gap-1">
            <button
              onClick={() => scrollToSection('header')}
              className="text-white/90 hover:text-white hover:bg-white/20 active:bg-white/30 px-4 py-2 rounded-xl transition-all duration-200 font-medium"
            >
              {t('navbar.home')}
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="text-white/90 hover:text-white hover:bg-white/20 active:bg-white/30 px-4 py-2 rounded-xl transition-all duration-200 font-medium"
            >
              {t('navbar.aboutUs')}
            </button>
            <button
              onClick={() => scrollToSection('services')}
              className="text-white/90 hover:text-white hover:bg-white/20 active:bg-white/30 px-4 py-2 rounded-xl transition-all duration-200 font-medium"
            >
              {t('navbar.services')}
            </button>
            <button
              onClick={() => scrollToSection('footer')}
              className="text-white/90 hover:text-white hover:bg-white/20 active:bg-white/30 px-4 py-2 rounded-xl transition-all duration-200 font-medium"
            >
              {t('navbar.contactUs')}
            </button>
            <LanguageSwitcher />
            <div className="w-px h-5 bg-white/30 mx-3" />
            {session ? (
              <Link
                to="/app/dashboard"
                className="bg-white/90 text-slate-900 px-5 py-2 rounded-xl hover:bg-white transition-all duration-200 font-semibold shadow-lg"
              >
                {t('navbar.dashboard')}
              </Link>
            ) : (
              <Dialog>
                <DialogTrigger asChild>
                  <button className="bg-white/90 text-slate-900 px-5 py-2 rounded-xl hover:bg-white transition-all duration-200 font-semibold shadow-lg">
                    {t('navbar.login')}
                  </button>
                </DialogTrigger>
                <DialogContent className="p-0 gap-0 max-w-[400px]">
                  <div className="flex items-center justify-center p-6 pb-0">
                    <img
                      src="/assets/logo2.png"
                      alt="WEMSP"
                      className="h-16 w-auto"
                    />
                  </div>
                  <div className="p-6 pt-4">
                    <LoginForm className="gap-4" />
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu - Liquid Glass style */}
      {isMenuOpen && (
        <div className="lg:hidden mx-4 mt-2 bg-white/10 backdrop-blur-2xl backdrop-saturate-150 rounded-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-inset ring-white/10 p-3 flex flex-col space-y-1 text-white">
          <button
            onClick={() => scrollToSection('header')}
            className="hover:bg-white/20 active:bg-white/30 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-left text-white/90"
          >
            {t('navbar.home')}
          </button>
          <button
            onClick={() => scrollToSection('about')}
            className="hover:bg-white/20 active:bg-white/30 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-left text-white/90"
          >
            {t('navbar.aboutUs')}
          </button>
          <button
            onClick={() => scrollToSection('services')}
            className="hover:bg-white/20 active:bg-white/30 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-left text-white/90"
          >
            {t('navbar.services')}
          </button>
          <button
            onClick={() => scrollToSection('footer')}
            className="hover:bg-white/20 active:bg-white/30 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-left text-white/90"
          >
            {t('navbar.contactUs')}
          </button>
          <div className="h-px bg-white/20 my-2" />
          <LanguageSwitcher />
          <div className="h-px bg-white/20 my-2" />
          {session ? (
            <Link
              to="/app/dashboard"
              className="bg-white/90 text-slate-900 px-4 py-3 rounded-xl hover:bg-white transition-all duration-200 font-semibold text-center block shadow-lg"
            >
              {t('navbar.dashboard')}
            </Link>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <button className="bg-white/90 text-slate-900 px-4 py-3 rounded-xl hover:bg-white transition-all duration-200 font-semibold text-center w-full shadow-lg">
                  {t('navbar.login')}
                </button>
              </DialogTrigger>
              <DialogContent className="p-0 gap-0 max-w-[400px]">
                <div className="flex items-center justify-center p-6 pb-0">
                  <img
                    src="/assets/logo2.png"
                    alt="WEMSP"
                    className="h-16 w-auto"
                  />
                </div>
                <div className="p-6 pt-4">
                  <LoginForm className="gap-4" />
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </nav>
  )
}

export default Navbar
