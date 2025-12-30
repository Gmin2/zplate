import Image from 'next/image'
import { notFound } from 'next/navigation'
import { PortableText } from '@portabletext/react'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { formatDate } from '@/lib/format-date'
import { portableTextComponents } from '@/components/content-components'
import { getPostBySlug, getAllPostSlugs } from '@/lib/actions'
import { Slash } from 'lucide-react'

export async function generateStaticParams() {
    const posts = await getAllPostSlugs()
    return posts.map((post) => ({
        slug: post.slug,
    }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const post = await getPostBySlug(slug)

    if (!post) {
        return {
            title: 'Post Not Found',
        }
    }

    return {
        title: `${post.title} - Blog`,
        description: post.description,
        openGraph: {
            title: `${post.title} - Blog`,
            description: post.description,
            images: [
                {
                    url: post.image,
                    width: 1200,
                    height: 675,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: `${post.title} - Blog`,
            description: post.description,
            images: [
                {
                    url: post.image,
                    width: 1200,
                    height: 675,
                },
            ],
        },
        alternates: {
            canonical: `/dark/blog-three/${slug}`,
        },
    }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const post = await getPostBySlug(slug)

    if (!post) {
        notFound()
    }

    return (
        <div className="relative mx-auto max-w-5xl px-6">
            <article>
                <header className="mx-auto mb-8 max-w-2xl text-center">
                    <Breadcrumb>
                        <BreadcrumbList className="justify-center gap-0.5 sm:gap-0.5">
                            <BreadcrumbItem>
                                <BreadcrumbLink href="/dark/blog-three">Blog</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator>
                                <Slash className="-rotate-16" />
                            </BreadcrumbSeparator>
                            <BreadcrumbItem>
                                <BreadcrumbLink
                                    className="text-foreground"
                                    href={`/dark/blog-three/category/${post.category.slug}`}>
                                    {post.category.title}
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>

                    <h1 className="text-foreground mt-6 text-balance text-3xl font-bold md:text-4xl md:leading-tight lg:text-5xl">{post.title}</h1>
                </header>

                <div className="relative overflow-hidden rounded-xl border shadow shadow-black/5">
                    <Image
                        src={post.image}
                        alt={post.title}
                        width={1200}
                        height={675}
                        className="aspect-video w-full object-cover"
                        priority
                    />
                </div>

                <div className="mx-auto max-w-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b py-6">
                        <div className="flex flex-wrap items-center gap-4">
                            {post.authors.map((author, index) => (
                                <div
                                    key={index}
                                    className="grid grid-cols-[auto_1fr] items-center gap-2">
                                    <div className="ring-border-illustration bg-card aspect-square size-6 overflow-hidden rounded-md border border-transparent shadow-md shadow-black/15 ring-1">
                                        <Image
                                            src={author.image}
                                            alt={author.name}
                                            width={460}
                                            height={460}
                                            className="size-full object-cover"
                                        />
                                    </div>
                                    <span className="text-foreground line-clamp-1 text-sm">{author.name}</span>
                                </div>
                            ))}
                        </div>
                        <time
                            className="text-muted-foreground text-sm"
                            dateTime={new Date(post.publishedAt).toISOString()}>
                            {formatDate(post.publishedAt)}
                        </time>
                    </div>

                    <p className="text-foreground my-16 text-xl md:text-2xl">{post.description}</p>

                    <div className="prose prose-slate dark:prose-invert max-w-none">
                        <PortableText
                            value={post.body}
                            components={portableTextComponents}
                        />
                    </div>
                </div>
            </article>
        </div>
    )
}