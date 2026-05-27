import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './index'
import { Skeleton } from './Skeleton'

export const SettingsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-10 w-60" />
        <div className="mt-2">
          <Skeleton className="h-4 w-full max-w-[24rem]" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar skeleton */}
        <div className="lg:col-span-1">
          <Card className="glass">
            <CardContent className="pt-6">
              <nav className="space-y-1">
                <div className="space-y-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Content skeleton */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-full" variant="circular" />
                  <Skeleton className="h-6 w-48" />
                </div>
              </CardTitle>
              <CardDescription>
                <Skeleton className="h-4 w-72 mt-2" />
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-12 w-full" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-12 w-full" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex items-center gap-4">
                    <Skeleton variant="circular" className="h-16 w-16" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-8 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Skeleton className="h-12 w-40" />
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default SettingsSkeleton
