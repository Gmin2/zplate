import { createClient } from 'next-sanity'

export const client = createClient({
    projectId: '6e6amfga',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: false,
})