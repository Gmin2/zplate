import { cn } from '@/lib/utils'
import Image from 'next/image'

export const Logo = ({ className, uniColor }: { className?: string; uniColor?: boolean }) => {
    return (
        <div className={cn('relative h-5 w-auto aspect-[78/18]', className)}>
            <Image
                src="/logo.png"
                alt="Logo"
                fill
                className="object-contain"
                priority
            />
        </div>
    )
}

export const LogoIcon = ({ className, uniColor }: { className?: string; uniColor?: boolean }) => {
    return (
        <div className={cn('relative size-5', className)}>
            <Image
                src="/logo.png"
                alt="Logo Icon"
                fill
                className="object-contain"
            />
        </div>
    )
}

export const LogoStroke = ({ className }: { className?: string }) => {
    return (
        <div className={cn('relative size-7', className)}>
             <Image
                src="/logo.png"
                alt="Logo Stroke"
                fill
                className="object-contain"
            />
        </div>
    )
}