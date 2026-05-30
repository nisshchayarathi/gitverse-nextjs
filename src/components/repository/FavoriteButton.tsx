'use client'

import React, { useState } from 'react'
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
  const [localIsFavorited, setLocalIsFavorited] = useState(initialIsFavorited)
  const [isPending, setIsPending] = useState(false)

  const handleToggle = async () => {
    const nextState = !localIsFavorited
    
    // Optimistically update UI
    setLocalIsFavorited(nextState)
    setIsPending(true)

    try {
      // Trigger actual server API mutation
      await onToggle(repositoryId, nextState)
      
      toast({
        title: nextState ? "Added to Favorites" : "Removed from Favorites",
        description: "Your repository collection has been updated successfully.",
      })
    } catch (error: any) {
      // Rollback on failure
      setLocalIsFavorited(!nextState)
      toast({
        title: "Update Failed",
        description: error?.message || "Failed to update favorite status. Reverting changes...",
        variant: "destructive",
      })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={isPending}
      className={`h-9 w-9 rounded-lg border border-border/50 hover:bg-accent transition-all duration-300 ${
        localIsFavorited
          ? "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 hover:text-red-600"
          : "text-muted-foreground hover:text-foreground"
      }`}
      aria-label={localIsFavorited ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        className={`h-5 w-5 transition-transform duration-300 active:scale-75 ${
          localIsFavorited ? "fill-current scale-110" : ""
        }`}
      />
    </Button>
  )
}
