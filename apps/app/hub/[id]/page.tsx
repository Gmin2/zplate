import { notFound } from 'next/navigation'
import { contracts } from '../data'
import ContractCodeViewer from '@/components/contract-code-viewer'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import fs from 'fs'
import path from 'path'

interface PageProps {
  params: {
    id: string
  }
}

export function generateStaticParams() {
  return contracts.map((contract) => ({
    id: contract.id,
  }))
}

async function getContractData(id: string) {
  const contract = contracts.find((c) => c.id === id)
  if (!contract) return null

  const contentDir = path.join(process.cwd(), 'content', id)
  
  // Read README
  let readme = ''
  try {
    readme = fs.readFileSync(path.join(contentDir, 'README.md'), 'utf8')
  } catch (e) {
    console.warn(`README not found for ${id}`)
  }

  // Read Code Files
  const files = []
  try {
    const dirFiles = fs.readdirSync(contentDir)
    for (const file of dirFiles) {
      if (file === 'README.md') continue
      
      const content = fs.readFileSync(path.join(contentDir, file), 'utf8')
      const language = file.endsWith('.sol') ? 'solidity' : 'typescript'
      
      files.push({
        name: file,
        language,
        content
      })
    }
  } catch (e) {
    console.warn(`Files not found for ${id}`)
  }

  // Sort files: Solidity first, then TypeScript
  files.sort((a, b) => {
    if (a.language === 'solidity' && b.language !== 'solidity') return -1
    if (a.language !== 'solidity' && b.language === 'solidity') return 1
    return a.name.localeCompare(b.name)
  })

  return {
    ...contract,
    readme,
    files
  }
}

export default async function ContractPage({ params }: PageProps) {
  const { id } = await params
  const contract = await getContractData(id)

  if (!contract) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-24" data-theme="dark">
      <div className="container mx-auto px-6">
        <div className="mb-8">
          <Link 
            href="/" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Hub
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">{contract.title}</h1>
              <p className="text-muted-foreground max-w-2xl">
                {contract.description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                {contract.category}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <ContractCodeViewer files={contract.files} readme={contract.readme} />
        </div>
      </div>
    </div>
  )
}
