import { BlogListWithPagination } from '@/app/(marketing)/blog/blog-list-with-pagination'
import { loadMorePosts, getInitialPosts, getTotalPostsCount } from '@/lib/actions'

const PAGE_SIZE = 12

export default async function BlogPage() {
    const [posts, totalCount] = await Promise.all([getInitialPosts(PAGE_SIZE), getTotalPostsCount()])

    return (
        <>
            <BlogListWithPagination
                initialPosts={posts}
                totalCount={totalCount}
                loadMoreAction={loadMorePosts}
            />
        </>
    )
}