import { notFound } from 'next/navigation'
import { CategoryBlogListWithPagination } from '@/app/(marketing)/blog/category-blog-list-with-pagination'
import { loadMoreCategoryPosts, getCategoryPosts, getCategoryPostsCount, getAllPosts, getAllCategories } from '@/lib/actions'

const PAGE_SIZE = 9

export async function generateStaticParams() {
    const categories = await getAllCategories()
    return categories.map((category) => ({
        category: category.slug,
    }))
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
    const { category: categorySlug } = await params
    const categories = await getAllCategories()
    const category = categories.find((c) => c.slug === categorySlug)

    if (!category) {
        return {
            title: 'Category Not Found',
        }
    }

    return {
        title: `${category.title} - Blog`,
        description: `Browse ${category.title} articles and insights`,
    }
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
    const { category } = await params
    const [posts, totalCount] = await Promise.all([getCategoryPosts(category, PAGE_SIZE), getCategoryPostsCount(category), getAllPosts()])

    if (posts.length === 0) {
        notFound()
    }

    const loadMoreAction = loadMoreCategoryPosts.bind(null, category)

    return (
        <CategoryBlogListWithPagination
            initialPosts={posts}
            totalCount={totalCount}
            loadMoreAction={loadMoreAction}
        />
    )
}