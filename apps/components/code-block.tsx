'use client'

import { cn } from '@/lib/utils'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { JSX, useLayoutEffect, useState } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import type { BundledLanguage } from 'shiki'
import { codeToHast } from 'shiki'

interface HighlightMatch {
    line: number            // 1-based line number
    column: number          // 0-based column where match starts
    length: number          // length of matched identifier
}

interface HighlightConfig {
    lines?: number[]           // Lines to subtle highlight
    tokens?: HighlightMatch[]  // Tokens to strong highlight
}

export async function highlight(code: string, lang: BundledLanguage, theme?: string, highlightConfig?: HighlightConfig) {
    const hast = await codeToHast(code, {
        lang,
        theme: theme || 'github-dark',
        transformers: [
            {
                name: 'hybrid-highlight',
                line(node: any, line: number) {
                    // Subtle background for containing lines
                    if (highlightConfig?.lines?.includes(line)) {
                        node.properties.class = (node.properties.class || '') +
                            ' bg-white/5 border-l-2 border-l-amber-500/50'
                    }
                },
                span(node: any, line: number, col: number) {
                    // Strong highlight for specific tokens
                    const matches = highlightConfig?.tokens?.filter(
                        t => t.line === line && t.column === col
                    ) || []

                    if (matches.length > 0) {
                        const existingClass = node.properties.class || ''
                        node.properties.class = existingClass +
                            ' bg-amber-400/30 border border-amber-500 rounded px-0.5 ' +
                            'ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20'
                    }
                }
            }
        ]
    })

    return toJsxRuntime(hast, {
        Fragment,
        jsx,
        jsxs,
    }) as JSX.Element
}

type Props = {
    code: string | null
    lang: BundledLanguage
    initial?: JSX.Element
    preHighlighted?: JSX.Element | null
    maxHeight?: number
    className?: string
    theme?: string
    lineNumbers?: boolean
    highlightConfig?: HighlightConfig
}

export default function CodeBlock({ code, lang, initial, maxHeight, preHighlighted, theme, className, highlightConfig }: Props) {
    const [content, setContent] = useState<JSX.Element | null>(preHighlighted || initial || null)

    useLayoutEffect(() => {
        if (preHighlighted) {
            return
        }

        let isMounted = true

        if (code) {
            highlight(code, lang, theme, highlightConfig).then((result) => {
                if (isMounted) setContent(result)
            })
        }

        return () => {
            isMounted = false
        }
    }, [code, lang, theme, preHighlighted, highlightConfig])

    return content ? (
        <div
            className={cn('[&_code]:text-[13px]/2 [&_code]:font-mono [&_pre]:border-l [&_pre]:p-2 [&_pre]:leading-snug', className)}
            style={{ '--pre-max-height': `${maxHeight}px` } as React.CSSProperties}>
            {content}
        </div>
    ) : (
        <pre className="rounded-lg p-4">Loading...</pre>
    )
}