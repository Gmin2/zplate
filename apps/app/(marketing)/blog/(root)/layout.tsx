import { BlogFilter } from '@/app/(marketing)/blog/category-filter'
import { Button } from '@/components/ui/button'
import { getInitialPosts, getTotalPostsCount } from '@/lib/actions'
import { Category } from '@/types/post'
import Link from 'next/link'

const PAGE_SIZE = 12

export default async function BlogLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const [posts] = await Promise.all([getInitialPosts(PAGE_SIZE), getTotalPostsCount()])

    const categories: Category[] = Array.from(new Map(posts.filter((post) => post.category).map((post) => [post.category.slug, post.category.title]))).map(([slug, title]) => ({ slug, title }))

    return (
        <>
            <div className="relative">
                <div className="absolute inset-0 z-10 mx-auto flex max-w-5xl flex-col px-6 py-24">
                    <div className="mx-auto max-w-3xl text-center">
                        <h1 className="mb-6 text-balance text-6xl font-semibold">
                            $2.5M to help you build <span className="bg-linear-to-b from-foreground/50 to-foreground/95 bg-clip-text text-transparent [-webkit-text-stroke:0.5px_var(--color-foreground)]">SaaS that scales</span>
                        </h1>
                        <Button
                            asChild
                            size="sm">
                            <Link href="#">Learn More</Link>
                        </Button>
                    </div>
                </div>
                <div className="mask-radial-from-65% mask-radial-at-bottom-right mask-radial-[100%_75%] mask-b-from-65% md:aspect-16/7 aspect-square">
                    <img
                        src="https://images.unsplash.com/photo-1533134486753-c833f0ed4866?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2340"
                        alt=""
                        className="size-full object-cover object-top"
                    />
                </div>
            </div>

            <BlogFilter
                categories={categories}
                posts={posts}
            />
            {children}
        </>
    )
}