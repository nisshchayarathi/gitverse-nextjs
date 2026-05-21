// This file contains route templates
const routes = {
  "app/api/ai/suggest-commit/route.ts": `import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { geminiService } from '@/lib/services/geminiService'

export async function POST(request: NextRequest) {
  try {
    requireAuth(request)
    const body = await request.json()
    const { added, modified, deleted, diff } = body

    const suggestions = await geminiService.suggestCommitMessage({
      added: added || [],
      modified: modified || [],
      deleted: deleted || [],
      diff,
    })

    return NextResponse.json({ suggestions })
  } catch (error: any) {
    console.error('Commit suggestion error:', error)
    return NextResponse.json(
      { error: 'Failed to generate suggestions', details: error.message },
      { status: 500 }
    )
  }
}`,
  "app/api/users/profile/route.ts": `import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/middleware'

export async function PUT(request: NextRequest) {
  try {
    const user = requireAuth(request)
    const body = await request.json()
    const { name, email, avatar } = body

    if (!name || !email) {
      return NextResponse.json(
        { message: 'Name and email are required' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        id: { not: user.userId },
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { message: 'Email is already in use' },
        { status: 400 }
      )
    }

    const updateData: any = { name, email }

    if (avatar && (avatar.startsWith('data:') || avatar.startsWith('http'))) {
      updateData.image = avatar
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      ...updatedUser,
      avatarUrl: (updatedUser as any).image,
    })
  } catch (error: any) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { message: 'Failed to update profile' },
      { status: 500 }
    )
  }
}`,
};

console.log(JSON.stringify(routes, null, 2));
