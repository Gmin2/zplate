'use client'

import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BlogCommandDialog } from '@/components/blog-command'
import { Post } from '@/types/post'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Rss } from 'lucide-react'

export type Category = {
    slug: string
    title: string
}

export type BlogFilterProps = {
    categories: Category[]
    posts: Post[]
}

export const BlogFilter = ({ categories, posts }: BlogFilterProps) => {
    const pathname = usePathname()
    const router = useRouter()

    const activeCategory = pathname === '/dark/blog-three' ? 'all' : pathname.split('/dark/blog-three/category/')[1]?.split('/')[0] || 'all'

    const handleClick = (slug: string) => {
        if (slug === 'all') router.push('/dark/blog-three')
        else router.push(`/dark/blog-three/category/${slug}`)
    }

    return (
        <div className="mx-auto my-8 max-w-5xl md:px-6">
            <div className="flex items-center justify-between gap-4">
                <div
                    className="-ml-0.5 flex snap-x snap-mandatory overflow-x-auto py-3 max-md:pl-6"
                    role="tablist"
                    aria-label="Blog categories">
                    <FilterButton
                        key="all"
                        category={{ slug: 'all', title: 'All' }}
                        activeCategory={activeCategory}
                        handleClick={handleClick}
                    />

                    {categories.map((category) => (
                        <FilterButton
                            key={category.slug}
                            category={category}
                            activeCategory={activeCategory}
                            handleClick={handleClick}
                        />
                    ))}
                </div>

                <div className="flex gap-1 max-md:pr-3">
                    <BlogCommandDialog
                        pageVariant="blog-three"
                        categories={categories}
                        posts={posts}
                    />
                    <Button
                        size="sm"
                        variant="ghost"
                        aria-label="RSS Feed">
                        <Link href="/rss.xml">
                            <Rss />
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}

const FilterButton = ({ category, activeCategory, handleClick }: { category: Category; activeCategory: string; handleClick: (slug: string) => void }) => {
    return (
        <button
            onClick={() => handleClick(category.slug)}
            role="tab"
            aria-selected={activeCategory === category.slug}
            className="text-muted-foreground group snap-center px-1 disabled:pointer-events-none disabled:opacity-50">
            <span className={cn('flex w-fit items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors [&>svg]:size-4', activeCategory === category.slug ? 'bg-foreground ring-foreground/5 text-background font-medium shadow-sm ring-1' : 'hover:text-foreground group-hover:bg-foreground/5')}>
                <span className="capitalize">{category.title}</span>
            </span>
        </button>
    )
}