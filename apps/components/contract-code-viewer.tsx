'use client'
import React, { useEffect, useRef, useState } from 'react'
import CodeBlock from "@/components/code-block"
import { FileCode, FileJson, FileType, BookOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface FileData {
    name: string
    content: string
    language: string
}

interface ContractCodeViewerProps {
    files: FileData[]
    readme?: string
}

interface HighlightMatch {
    line: number            // 1-based line number
    column: number          // 0-based column where match starts
    length: number          // length of matched identifier
}

interface HighlightConfig {
    lines?: number[]           // Lines to subtle highlight
    tokens?: HighlightMatch[]  // Tokens to strong highlight
}

export default function ContractCodeViewer({ files, readme }: ContractCodeViewerProps) {
    const [indicatorLeft, setIndicatorLeft] = useState(0)
    const [indicatorWidth, setIndicatorWidth] = useState(0)
    const [activeTab, setActiveTab] = useState<string>(files[0]?.name || '')
    const [highlightConfig, setHighlightConfig] = useState<HighlightConfig>({})
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

    useEffect(() => {
        const activeTabRef = tabRefs.current[activeTab]
        if (activeTabRef) {
            const parentElement = activeTabRef.parentElement
            if (parentElement) {
                const parentLeft = parentElement.getBoundingClientRect().left
                const buttonLeft = activeTabRef.getBoundingClientRect().left
                const buttonWidth = activeTabRef.offsetWidth

                const newIndicatorLeft = buttonLeft - parentLeft + 16
                const newIndicatorWidth = buttonWidth
                setIndicatorLeft(newIndicatorLeft)
                setIndicatorWidth(newIndicatorWidth)
            }
        }
    }, [activeTab])

    const activeFileData = files.find((file) => file.name === activeTab)

    const getIcon = (name: string) => {
        if (name.endsWith('.sol')) return FileCode
        if (name.endsWith('.ts') || name.endsWith('.js')) return FileType
        return FileJson
    }

    /**
     * Extract searchable identifier from inline code
     * Examples:
     *   "FHE.add()" → "FHE.add"
     *   "euint32" → "euint32"
     *   "_count" → "_count"
     */
    const extractIdentifier = (code: string): string => {
        // Remove parentheses and arguments
        let clean = code.replace(/\([^)]*\)/g, '')
        // Remove trailing dots/semicolons
        clean = clean.replace(/[.;,]+$/, '')
        // Trim whitespace
        return clean.trim()
    }

    /**
     * Find all occurrences of an identifier in source code
     * Returns both line numbers and token positions
     */
    const findIdentifierOccurrences = (
        source: string,
        identifier: string
    ): HighlightConfig => {
        const sourceLines = source.split('\n')
        const lines = new Set<number>()
        const tokens: HighlightMatch[] = []

        // Escape special regex characters
        const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

        // Match identifier with word boundaries
        // Handles: FHE.add, euint32, _count
        const pattern = new RegExp(`\\b${escaped}\\b`, 'g')

        sourceLines.forEach((line, index) => {
            let match
            while ((match = pattern.exec(line)) !== null) {
                const lineNum = index + 1
                lines.add(lineNum)
                tokens.push({
                    line: lineNum,
                    column: match.index,
                    length: identifier.length
                })
            }
            pattern.lastIndex = 0 // Reset regex state
        })

        return {
            lines: Array.from(lines).sort((a, b) => a - b),
            tokens
        }
    }

    const findCodeLines = (source: string, snippet: string): number[] => {
        const lines = []
        const sourceLines = source.split('\n')
        const snippetLines = snippet.trim().split('\n')

        if (snippetLines.length === 0) return []

        // Simple sliding window search
        for (let i = 0; i <= sourceLines.length - snippetLines.length; i++) {
            let match = true
            for (let j = 0; j < snippetLines.length; j++) {
                if (!sourceLines[i + j].includes(snippetLines[j].trim())) {
                    match = false
                    break
                }
            }
            if (match) {
                for (let j = 0; j < snippetLines.length; j++) {
                    lines.push(i + j + 1) // 1-based line numbers
                }
                break // Only highlight first occurrence
            }
        }
        return lines
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
            {/* Left Panel: README / Walkthrough */}
            {readme && (
                <div className="bg-card/50 rounded-2xl border border-white/10 overflow-hidden flex flex-col backdrop-blur-sm">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
                        <BookOpen className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">Documentation</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <div className="prose prose-invert prose-sm max-w-none 
                            prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground
                            prose-h1:text-2xl prose-h1:mb-6 prose-h1:pb-2 prose-h1:border-b prose-h1:border-white/10
                            prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
                            prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                            prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-4
                            prose-li:text-muted-foreground
                            prose-strong:text-foreground prose-strong:font-medium
                            prose-code:text-primary prose-code:bg-primary/10 prose-code:rounded-md prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none
                            prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-pre:p-4
                            prose-blockquote:border-l-2 prose-blockquote:border-primary/50 prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-muted-foreground
                            [&>*:first-child]:mt-0">
                            <ReactMarkdown
                                components={{
                                    code(props) {
                                        const {children, className, node, ...rest} = props
                                        const match = /language-(\w+)/.exec(className || '')
                                        const isBlock = match && String(children).includes('\n')
                                        const content = String(children).replace(/\n$/, '')
                                        
                                        if (isBlock) {
                                            return (
                                                <div
                                                    className="not-prose my-4"
                                                    onMouseEnter={() => {
                                                        if (activeFileData) {
                                                            const lines = findCodeLines(activeFileData.content, content)
                                                            if (lines.length > 0) {
                                                                // Use old findCodeLines for code blocks for now
                                                                setHighlightConfig({ lines, tokens: [] })
                                                            }
                                                        }
                                                    }}
                                                    onMouseLeave={() => setHighlightConfig({})}
                                                >
                                                    <CodeBlock
                                                        code={content}
                                                        lang={(match?.[1] || 'text') as any}
                                                        className="border border-white/10 shadow-sm"
                                                        theme="github-dark"
                                                    />
                                                </div>
                                            )
                                        }
                                        
                                        // Inline code - make it interactive and pop out
                                        return (
                                            <code
                                                {...rest}
                                                className={`${className} cursor-pointer bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-md font-mono text-[0.9em] hover:bg-primary/20 transition-all duration-200`}
                                                onMouseEnter={() => {
                                                    if (activeFileData) {
                                                        const identifier = extractIdentifier(content)
                                                        const config = findIdentifierOccurrences(activeFileData.content, identifier)
                                                        setHighlightConfig(config)
                                                    }
                                                }}
                                                onMouseLeave={() => setHighlightConfig({})}
                                            >
                                                {children}
                                            </code>
                                        )
                                    },
                                    // Custom styling for other elements if needed
                                    a: ({node, ...props}) => (
                                        <a {...props} className="text-primary hover:underline underline-offset-4 decoration-primary/50" target="_blank" rel="noopener noreferrer" />
                                    ),
                                    ul: ({node, ...props}) => (
                                        <ul {...props} className="list-disc list-outside ml-4 space-y-1 mb-4" />
                                    ),
                                    ol: ({node, ...props}) => (
                                        <ol {...props} className="list-decimal list-outside ml-4 space-y-1 mb-4" />
                                    ),
                                }}
                            >
                                {readme}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>
            )}

            {/* Right Panel: Code Viewer */}
            <div className={`ring-foreground/10 bg-(--code-background) relative z-10 overflow-hidden rounded-2xl border border-transparent px-1 pb-1 shadow-lg shadow-black/10 ring-1 backdrop-blur [--code-background:color-mix(in_oklab,var(--color-zinc-900)35%,var(--color-zinc-950))] [--code-editor-background:color-mix(in_oklab,var(--color-zinc-900)75%,var(--color-zinc-950))] ${!readme ? 'lg:col-span-2' : ''} flex flex-col`}>
                <div className="relative h-10 flex-none">
                    <div className="flex h-full items-center gap-1 overflow-x-auto no-scrollbar">
                        {files.map((file) => {
                            const Icon = getIcon(file.name)
                            return (
                                <button
                                    key={file.name}
                                    ref={(el) => {
                                        tabRefs.current[file.name] = el
                                    }}
                                    onClick={() => setActiveTab(file.name)}
                                    data-tab={file.name}
                                    data-state={activeTab === file.name ? 'active' : ''}
                                    className="not-data-[state=active]:hover:bg-muted/50 text-foreground/75 relative z-10 flex h-8 items-center gap-1.5 rounded-lg px-3 font-mono text-xs first:rounded-tl-xl whitespace-nowrap">
                                    <Icon className="size-3 text-amber-600" />
                                    {file.name}
                                </button>
                            )
                        })}
                    </div>
                    <div
                        className="bg-(--code-editor-background) absolute -bottom-px top-1 -translate-x-4 rounded-t-xl border-x border-t transition-all duration-300 ease-out"
                        style={{ left: indicatorLeft, width: `${indicatorWidth}px` }}>
                        {activeTab === files[0]?.name ? (
                            <div className="bg-(--code-editor-background) absolute -bottom-4 -left-px size-4 border-l"></div>
                        ) : (
                            <div className="bg-(--code-editor-background) absolute -left-4 bottom-0 size-4">
                                <div className="bg-(--code-background) absolute inset-0 rounded-br-xl border-b border-r"></div>
                            </div>
                        )}

                        <div className="bg-(--code-editor-background) absolute -right-4 bottom-0 size-4">
                            <div className="bg-(--code-background) absolute inset-0 rounded-bl-xl border-b border-l"></div>
                        </div>
                    </div>
                </div>

                <div className="bg-(--code-editor-background) flex-1 rounded-xl border overflow-hidden">
                    <div className="mask-y-from-80% scheme-dark h-full overflow-auto">
                        <CodeBlock
                            code={activeFileData?.content ?? ''}
                            lang={(activeFileData?.language || 'text') as any}
                            lineNumbers
                            highlightConfig={highlightConfig}
                            className="-mx-1 [&_pre]:h-fit [&_pre]:min-h-[12rem] [&_pre]:rounded-xl [&_pre]:border-none [&_pre]:!bg-transparent [&_pre]:pb-0"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
