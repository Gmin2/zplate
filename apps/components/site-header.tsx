import Link from "next/link"
import { Github, Twitter, Sun, Moon } from "lucide-react"
import { Logo } from "@/components/logo"

export function SiteHeader() {
  return (
    <header className="container mx-auto px-4 py-8 flex items-center justify-between">
      <div className="font-bold text-lg tracking-tight">
        <Link href="/">
          <Logo className="h-8" />
        </Link>
      </div>
      <nav className="flex items-center gap-6 text-sm text-muted-foreground">
        <button className="hover:text-foreground transition-colors">
          <Sun className="h-4 w-4 hidden dark:block" />
          <Moon className="h-4 w-4 block dark:hidden" />
          <span className="sr-only">Toggle theme</span>
        </button>
      </nav>
    </header>
  )
}
