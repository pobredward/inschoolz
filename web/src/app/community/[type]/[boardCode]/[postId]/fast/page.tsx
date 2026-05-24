"use client";

import React from 'react';
import { PostViewClientFast } from '@/components/board/PostViewClientFast';
import { BoardType } from '@/types/board';

interface FastPostPageProps {
  params: Promise<{
    type: BoardType;
    boardCode: string;
    postId: string;
  }>;
}

export default function FastPostPage({ params }: FastPostPageProps) {
  return <PostViewClientFast params={params} />;
}
