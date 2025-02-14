import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MessageSkeletonProps {
    depth?: number;
    hasReplies?: boolean;
    maxDepth?: number;
}

export const MessageSkeleton: React.FC<MessageSkeletonProps> = ({
    depth = 0,
    hasReplies = Math.random() > 0.5, // Randomly show replies in skeleton for visual variety
    maxDepth = 2 // Limit recursion depth
}) => {
    const indent = depth === 16;
    const shouldShowReplies = hasReplies && depth < maxDepth;

    return (
        <div className="mt-2" style={{ marginLeft: `${indent}px` }}>
            <div className={cn(
                "flex items-start space-x-1 p-1 rounded-lg",
                depth === 0 && "border-2 border-border"
            )}>
                <div className="flex-grow p-0 overflow-hidden">
                    <div className="flex flex-col">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2">
                            <Skeleton className="h-6 w-6" /> {/* Collapse button */}
                            <Skeleton className="h-4 w-24" /> {/* Publisher name */}
                            <Skeleton className="h-5 w-16" /> {/* Model badge */}
                        </div>

                        {/* Content */}
                        <div className="space-y-2 ml-3.5">
                            <Skeleton className="h-4 w-[80%]" />
                            <Skeleton className="h-4 w-[90%]" />
                            <Skeleton className="h-4 w-[60%]" />
                        </div>
                    </div>
                </div>
            </div>

            {shouldShowReplies && (
                <>
                    {Array.from({ length: Math.floor(Math.random() * 3) + 1 }).map((_, index, arr) => (
                        <div key={index} className={cn(
                            "ml-4 relative",
                            "before:absolute before:left-0 before:-top-2 before:w-[17px] before:h-10",
                            "before:border-b-2 before:border-l-2 before:border-border before:rounded-bl-lg",
                            // Only show continuing line if not the last reply
                            index !== arr.length - 1 && "after:absolute after:left-0 after:top-5 after:-bottom-0 after:border-l-2 after:border-border"
                        )}>
                            <MessageSkeleton
                                depth={depth + 1}
                                hasReplies={false}
                                maxDepth={maxDepth}
                            />
                        </div>
                    ))}
                </>
            )}
        </div>
    );
};