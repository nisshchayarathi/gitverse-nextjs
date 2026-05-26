'use client'

import React, { useOptimistic, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { toast } from '@/hooks/use-toast'

interface FavoriteButtonProps {
  initialIsFavorited: boolean
  repositoryId: string
  onToggle: (id: string, nextState: boolean) => Promise<void>
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  initialIsFavorited,
  repositoryId,
  onToggle,
}) => {
  const [isPending, startTransition] = useTransition()

  // Set up optimistic UI state
  const [optimisticIsFavorited, setOptimisticIsFavorited] = useOptimistic(
    initialIsFavorited,
    (currentState: boolean, optimisticValue: boolean) => optimisticValue
  )

  const handleToggle = () => {
    // Instantly reflect the user's action in the UI
    startTransition(async () => {
      const nextState = !optimisticIsFavorited
      setOptimisticIsFavorited(nextState)

      try {
        // Trigger actual server API mutation
        await onToggle(repositoryId, nextState)
        
        toast({
          title: nextState ? "Added to Favorites" : "Removed from Favorites",
          description: "Your repository collection has been updated successfully.",
        })
      } catch (error: any) {
        // Handle failure: Trigger rollback warning
        toast({
          title: "Update Failed",
          description: error?.message || "Failed to update favorite status. Reverting changes...",
          variant: "destructive",
        })
        // The optimistic UI state rolls back automatically since the parent actual state is not updated!
      }
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={isPending}
      className={`h-9 w-9 rounded-lg border border-border/50 hover:bg-accent transition-all duration-300 ${
        optimisticIsFavorited
          ? "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 hover:text-red-600"
          : "text-muted-foreground hover:text-foreground"
      }`}
      aria-label={optimisticIsFavorited ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        className={`h-5 w-5 transition-transform duration-300 active:scale-75 ${
          optimisticIsFavorited ? "fill-current scale-110" : ""
        }`}
      />
    </Button>
  )
}
