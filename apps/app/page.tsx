"use client"

import Link from 'next/link'
import { contracts } from './hub/data'
import { useState, useMemo } from 'react'

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const categories = useMemo(() => {
    const cats = new Set(contracts.map(c => c.category))
    return Array.from(cats)
  }, [])

  const filteredContracts = useMemo(() => {
    if (!selectedCategory) return contracts
    return contracts.filter(c => c.category === selectedCategory)
  }, [selectedCategory])

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              selectedCategory === null
                ? "bg-white text-black"
                : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            }`}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedCategory === category
                  ? "bg-white text-black"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_3fr_1fr] gap-4 text-sm text-muted-foreground mb-4 px-2">
          <div>date</div>
          <div>title</div>
          <div className="text-right">views</div>
        </div>
        
        <div className="space-y-0">
          {filteredContracts.map((contract, index) => (
            <div key={contract.id} className="group">
              <Link 
                href={`/hub/${contract.id}`}
                className="grid grid-cols-[1fr_3fr_1fr] gap-4 py-3 px-2 border-t border-white/10 hover:bg-white/5 transition-colors items-center"
              >
                <div className="text-muted-foreground">2025</div>
                <div className="font-medium text-foreground group-hover:text-white transition-colors">
                  {contract.title}
                </div>
                <div className="text-right text-muted-foreground">
                  {Math.floor(Math.random() * 500) + 50}
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
